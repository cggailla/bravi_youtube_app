"use server";

import { createClient } from "@/lib/supabase/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { inngest } from "@/lib/inngest/client";
// import { revalidatePath } from "next/cache"; // Optional, uncomment if needed

type ActionResult = { message: string; error?: boolean };


function isValidYoutubeUrl(url: string): boolean {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, "");
    if (host === "youtube.com" || host === "m.youtube.com" || host === "youtu.be") {
      // youtube.com/watch?v=... or youtu.be/...
      if (host === "youtu.be") return u.pathname.length > 1;
      if (host.includes("youtube.com")) return u.pathname === "/watch" && !!u.searchParams.get("v");
    }
    return false;
  } catch {
    return false;
  }
}

function extractYoutubeId(url: string): string | null {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, "");
    if (host === "youtu.be") {
      const id = u.pathname.slice(1);
      return id || null;
    }
    if (host === "youtube.com" || host === "m.youtube.com") {
      const v = u.searchParams.get("v");
      return v || null;
    }
    return null;
  } catch {
    return null;
  }
}

export async function addYoutubeContent(
  _previousState: any,
  formData: FormData,
): Promise<ActionResult> {
  const rawUrl = String(formData.get("url") ?? "").trim();
  console.log("[Server Action] Received formData.url:", rawUrl);
  if (!rawUrl) return { message: "Please provide a URL.", error: true };

  // Authenticated user
  const supabase = await createClient();
  console.log("[Server Action] Created Supabase server client. Env presence:", {
    hasUrl: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
    hasKey: Boolean(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY),
  });
  const { data: userData, error: userError } = await supabase.auth.getUser();
  const user = userData?.user;
  console.log("[Server Action] getUser result:", {
    userError: userError?.message,
    userId: user?.id,
    email: user?.email,
  });
  if (userError || !user) {
    return { message: "User not authenticated", error: true };
  }

  console.log(`[Server Action] Tentative d'ingestion pour userId: ${user.id}`);

  // Validate URL
  const valid = isValidYoutubeUrl(rawUrl);
  console.log("[Server Action] URL validation:", { valid });
  if (!valid) {
    return { message: "Invalid YouTube video URL", error: true };
  }

  // Extract video id
  const youtubeId = extractYoutubeId(rawUrl);
  console.log("[Server Action] Extracted youtubeId:", youtubeId);
  if (!youtubeId) {
    return { message: "Could not extract video ID", error: true };
  }

  // ---- 4. Launch concurrent async operations ----
  const youtubeApiPromise = (async () => {
    let title = null;
    let channelName = null;
    let thumbnailUrl = null;
    let duration = null;

    try {
      const apiKey = process.env.YOUTUBE_API_KEY;
      if (!apiKey) {
        console.warn("[YouTube API] No API key found, skipping metadata fetch");
        return { title, channelName, thumbnailUrl, duration };
      }

      const apiUrl = `https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails&id=${youtubeId}&key=${apiKey}`;
      const res = await fetch(apiUrl);
      const json = await res.json();

      if (json.items && json.items.length > 0) {
        const item = json.items[0];
        title = item.snippet.title;
        channelName = item.snippet.channelTitle;
        thumbnailUrl = item.snippet.thumbnails?.high?.url;
        duration = item.contentDetails.duration; // "PT9M5S" format
      } else {
        console.warn("[YouTube API] No data found for", youtubeId);
      }
    } catch (err) {
      console.error("[YouTube API] Error fetching metadata:", err);
    }

    // Convert ISO 8601 duration -> seconds
    const parseISO8601Duration = (iso: string): number => {
      const match = iso?.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
      if (!match) return 0;
      const [, h, m, s] = match.map((x) => parseInt(x || "0", 10));
      return h * 3600 + m * 60 + s;
    };
    const durationSeconds = duration ? parseISO8601Duration(duration) : null;

    return { title, channelName, thumbnailUrl, durationSeconds };
  })();

  const prismaUserPromise = (async () => {
    try {
      const prismaUser = await prisma.user.findUnique({
        where: { id: user.id },
      });
      if (!prismaUser) {
        throw new Error(`User ${user.id} not found in auth.users`);
      }
      return prismaUser;
    } catch (err) {
      console.error("[Server Action] Error verifying Prisma user:", err);
      throw new Error("Internal error: Cannot verify user reference");
    }
  })();

  // ---- 5. Await both async tasks ----
  const [youtubeData, prismaUser] = await Promise.allSettled([
    youtubeApiPromise,
    prismaUserPromise,
  ]);

  if (prismaUser.status === "rejected") {
    return { message: prismaUser.reason?.message ?? "User verification failed", error: true };
  }

  const videoMeta: {
    title?: string | null;
    channelName?: string | null;
    thumbnailUrl?: string | null;
    durationSeconds?: number | null;
  } = youtubeData.status === "fulfilled" ? youtubeData.value : {};

  console.log("[Server Action] YouTube metadata resolved:", videoMeta);

  // ---- 6. Persist to DB ----
  let newVideo;
  try {
    newVideo = await prisma.video.create({
      data: {
        youtubeId,
        userId: user.id,
        status: "QUEUED",
        title: videoMeta.title || `YouTube ${youtubeId}`,
        channelName: videoMeta.channelName || null,
        thumbnailUrl: videoMeta.thumbnailUrl || null,
        duration: videoMeta.durationSeconds || null,
      },
    });
    console.log("[Server Action] prisma.video.create OK:", {
      id: newVideo.id,
      youtubeId: newVideo.youtubeId,
    });
  } catch (err) {
    console.error("Prisma create(video) failed:", err);
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      if (err.code === "P2002") return { message: "Video already queued.", error: true };
      if (err.code === "P2003") console.error("[Server Action] P2003 Foreign key error:", (err as any).meta);
    }
    return { message: "Database error", error: true };
  }


  // Trigger ingestion via Inngest
  try {
    console.log("[Server Action] Sending Inngest event youtube/video.ingest …", {
      videoId: newVideo.id,
      userId: user.id,
      youtubeId,
    });
    await inngest.send({
      name: "youtube/video.ingest",
      data: {
        videoId: newVideo.id,
        userId: user.id,
        youtubeId,
      },
    });
    console.log("[Server Action] Inngest event queued successfully");
  } catch (err) {
    console.error("[Server Action] Inngest send failed:", err);
    return { message: "Failed to queue video for processing", error: true };
  }

  // Optionally revalidate lists
  // revalidatePath("/protected");

  return { message: "Video added to queue successfully!" };
}

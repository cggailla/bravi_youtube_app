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

  // 4. *** NEW: Verify user exists from Prisma's perspective ***
  try {
    const prismaUser = await prisma.user.findUnique({
      where: { id: user.id },
    });
    if (!prismaUser) {
      console.error(`[Server Action] CRITICAL: Prisma cannot find user ${user.id} in auth.users right before create!`);
      // This indicates a deeper issue, potentially DB replication lag or schema mismatch despite checks.
      return { message: "Internal error: User reference mismatch", error: true };
    } else {
      console.log(`[Server Action] Prisma successfully found user ${user.id} in auth.users.`);
    }
  } catch (findError) {
    console.error("[Server Action] Error querying auth.users with Prisma:", findError);
    return { message: "Internal error: Cannot verify user reference", error: true };
  }
  // --- END NEW CHECK ---

  // Introspect DB constraints to detect unexpected FK remnants
  try {
    const fkRows = await prisma.$queryRaw<any[]>`
      SELECT conname, conrelid::regclass as table
      FROM pg_constraint
      WHERE contype = 'f' AND conname ILIKE 'video_userid_fkey'
    `;
    console.log("[Server Action] Constraint check (video_userid_fkey):", fkRows);
  } catch (e) {
    console.warn("[Server Action] Constraint check failed:", e);
  }

  try {
    const tableInfo = await prisma.$queryRaw<any[]>`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'Video'
    `;
    console.log("[Server Action] public.Video columns:", tableInfo);
  } catch (e) {
    console.warn("[Server Action] Describe table failed:", e);
  }

  // Persist to DB
  console.log("[Server Action] Tentative d'ingestion pour userId:", user.id);
  let newVideo;
  try {
    newVideo = await prisma.video.create({
      data: {
        youtubeId,
        userId: user.id,
        status: "QUEUED",
        title: `YouTube ${youtubeId}`,
      },
    });
    console.log("[Server Action] prisma.video.create OK:", { id: newVideo.id, youtubeId: newVideo.youtubeId });
  } catch (err) {
    // Improve feedback for common cases and log details server-side
    console.error("Prisma create(video) failed:", err);
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      if (err.code === "P2002") {
        return { message: "Video already queued.", error: true };
      }
      if (err.code === "P2003") {
        console.error("[Server Action] P2003 Foreign key error details:", (err as any).meta);
      }
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

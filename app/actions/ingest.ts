"use server";

import { createClient } from "@/lib/supabase/server";
import { Prisma, PrismaClient } from "@prisma/client";
import { inngest } from "@/lib/inngest/client";
// import { revalidatePath } from "next/cache"; // Optional, uncomment if needed

type ActionResult = { message: string; error?: boolean };

// Local Prisma client (simple instantiation; replace with a shared singleton if available)
const prisma = new PrismaClient();

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
  if (!rawUrl) return { message: "Please provide a URL.", error: true };

  // Authenticated user
  const supabase = await createClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();
  const user = userData?.user;
  if (userError || !user) {
    return { message: "User not authenticated", error: true };
  }

  // Validate URL
  if (!isValidYoutubeUrl(rawUrl)) {
    return { message: "Invalid YouTube video URL", error: true };
  }

  // Extract video id
  const youtubeId = extractYoutubeId(rawUrl);
  if (!youtubeId) {
    return { message: "Could not extract video ID", error: true };
  }

  // Persist to DB
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
  } catch (err) {
    // Improve feedback for common cases and log details server-side
    console.error("Prisma create(video) failed:", err);
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      if (err.code === "P2002") {
        return { message: "Video already queued.", error: true };
      }
    }
    return { message: "Database error", error: true };
  }

  // Trigger ingestion via Inngest
  try {
    await inngest.send({
      name: "youtube/video.ingest",
      data: {
        videoId: newVideo.id,
        userId: user.id,
        youtubeId,
      },
    });
  } catch (err) {
    return { message: "Failed to queue video for processing", error: true };
  }

  // Optionally revalidate lists
  // revalidatePath("/protected");

  return { message: "Video added to queue successfully!" };
}

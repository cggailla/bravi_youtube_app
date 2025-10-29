import { inngest } from "@/lib/inngest/client";
import { prisma } from "@/lib/prisma";
import { processYoutubeVideo } from "@/lib/zeroentropy/zeroentropy";

type YoutubeIngestEvent = {
  data: {
    videoId: string;
    userId: string;
    youtubeId: string;
  };
};

function buildYoutubeUrl(youtubeId: string): string {
  if (youtubeId.startsWith("http://") || youtubeId.startsWith("https://")) {
    return youtubeId;
  }
  return `https://www.youtube.com/watch?v=${youtubeId}`;
}

export const youtubeVideoIngest = inngest.createFunction(
  { id: "youtube-video-ingest", name: "YouTube Video Ingest", concurrency: { limit: 1 } },
  { event: "youtube/video.ingest" },
  async ({ event, step, logger }) => {
    const { videoId, userId, youtubeId } = (event as YoutubeIngestEvent).data;

    const videoRecord = await step.run("load-video", async () => {
      const video = await prisma.video.findUnique({ where: { id: videoId } });
      if (!video) {
        throw new Error(`Video ${videoId} not found`);
      }
      return video;
    });

    if (videoRecord.status === "READY") {
      logger.info("Video already marked as READY; skipping pipeline", { videoId });
      return;
    }

    await step.run("mark-processing", async () => {
      await prisma.video.update({
        where: { id: videoId },
        data: {
          status: "PROCESSING",
          errorMessage: null,
          updatedAt: new Date(),
        },
      });
    });

    try {
      const resolvedYoutubeId = youtubeId || videoRecord.youtubeId;
      if (!resolvedYoutubeId) {
        throw new Error("Missing YouTube identifier for ingestion");
      }

      const youtubeUrl = buildYoutubeUrl(resolvedYoutubeId);

      const pipelineResult = await step.run("process-youtube", async () => {
        return processYoutubeVideo(youtubeUrl, userId);
      });

      if (!pipelineResult?.success) {
        throw new Error("Pipeline did not complete successfully");
      }

      logger.info("ZeroEntropy pipeline completed", {
        videoId,
        lang: pipelineResult.lang,
        stats: pipelineResult.stats,
      });

      await step.run("mark-ready", async () => {
        await prisma.video.update({
          where: { id: videoId },
          data: {
            status: "READY",
            errorMessage: null,
            updatedAt: new Date(),
          },
        });
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Unknown ingestion error";
      logger.error("YouTube ingestion pipeline failed", { videoId, error: message });

      await step.run("mark-failed", async () => {
        await prisma.video.update({
          where: { id: videoId },
          data: {
            status: "FAILED",
            errorMessage: message.slice(0, 500),
            updatedAt: new Date(),
          },
        });
      });

      throw error;
    }
  },
);

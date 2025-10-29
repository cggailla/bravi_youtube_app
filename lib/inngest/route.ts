import { serve } from "inngest/next";
import { inngest } from "@/lib/inngest/client";
import { youtubeVideoIngest } from "@/lib/inngest/functions/youtube";

// Create an API that serves zero functions
export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [youtubeVideoIngest],
});

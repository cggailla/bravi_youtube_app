import { YoutubeTranscript } from "youtube-transcript-plus";

export type ZeroEntropyDocument = {
  id: string;
  text: string;
  metadata: Record<string, string | number | boolean | null>;
};

type RawTranscriptSegment = {
  text: string;
  duration: number;
  offset: number;
  lang?: string;
};

type TranscriptSegment = {
  index: number;
  text: string;
  startSec: number;
  endSec: number;
  lang?: string;
};

export type TranscriptChunk = {
  index: number;
  text: string;
  startSec: number;
  endSec: number;
  segmentRange: [number, number];
};

type ZeroEntropyConfig = {
  apiUrl: string;
  apiKey: string;
  maxChunkChars: number;
};

type ZeroEntropyStatusResponse = {
  num_documents: number;
  num_indexed_documents: number;
  num_failed_documents: number;
  [key: string]: unknown;
};

const DEFAULT_MAX_CHARS_PER_CHUNK = 3000;
const DEFAULT_API_URL = "https://api.zeroentropy.ai";

let cachedConfig: ZeroEntropyConfig | null = null;

function resolveEnv(keys: string[]): string | undefined {
  for (const key of keys) {
    const value = process.env[key];
    if (value) return value;
  }
  return undefined;
}

function getZeroEntropyConfig(): ZeroEntropyConfig {
  if (cachedConfig) return cachedConfig;

  const apiKey = resolveEnv(["ZERO_ENTROPY_API_KEY", "ZEROENTROPY_API_KEY"]);
  if (!apiKey) {
    throw new Error(
      "Missing ZeroEntropy API key. Set ZERO_ENTROPY_API_KEY in your environment.",
    );
  }

  const apiUrl =
    resolveEnv(["ZERO_ENTROPY_URL", "ZEROENTROPY_API_URL"]) ?? DEFAULT_API_URL;

  const maxCharsRaw = resolveEnv([
    "ZERO_ENTROPY_MAX_CHARS",
    "ZEROENTROPY_MAX_CHARS",
  ]);
  const parsedMaxChars = maxCharsRaw ? Number(maxCharsRaw) : undefined;
  const maxChunkChars =
    typeof parsedMaxChars === "number" &&
    Number.isFinite(parsedMaxChars) &&
    parsedMaxChars > 0
      ? parsedMaxChars
      : DEFAULT_MAX_CHARS_PER_CHUNK;

  cachedConfig = { apiKey, apiUrl, maxChunkChars };
  return cachedConfig;
}

/**
 * Normalizes transcript text from YouTube.
 */
export function cleanText(text: string): string {
  return text
    .replace(/&amp;#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Maps raw transcript entries into typed segments.
 */
export function toSegments(rawTranscript: RawTranscriptSegment[]): TranscriptSegment[] {
  return rawTranscript
    .map((segment, index) => {
      const cleanedText = cleanText(segment.text ?? "");
      const duration = typeof segment.duration === "number" ? segment.duration : 0;
      const offset = typeof segment.offset === "number" ? segment.offset : 0;

      return {
        index,
        text: cleanedText,
        startSec: Number(offset.toFixed(3)),
        endSec: Number((offset + duration).toFixed(3)),
        lang: segment.lang,
      };
    })
    .filter((segment) => segment.text.length > 0);
}

/**
 * Groups consecutive segments into chunks up to the configured size.
 */
export function chunkSegments(
  segments: TranscriptSegment[],
  maxChars: number = getZeroEntropyConfig().maxChunkChars,
): TranscriptChunk[] {
  if (segments.length === 0) return [];

  const chunks: TranscriptChunk[] = [];
  let currentText = "";
  let startSec = segments[0]?.startSec ?? 0;
  let chunkStartIndex = 0;

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    const newText = (currentText + " " + seg.text).trim();

    if (newText.length > maxChars && currentText.length > 0) {
      const previous = segments[i - 1];
      const endSec = previous?.endSec ?? seg.endSec;
      chunks.push({
        index: chunks.length,
        text: currentText.trim(),
        startSec,
        endSec,
        segmentRange: [chunkStartIndex, Math.max(i - 1, chunkStartIndex)],
      });

      currentText = seg.text;
      startSec = seg.startSec;
      chunkStartIndex = i;
    } else {
      currentText = newText;
    }
  }

  if (currentText.length > 0) {
    const lastSegment = segments[segments.length - 1];
    chunks.push({
      index: chunks.length,
      text: currentText.trim(),
      startSec,
      endSec: lastSegment?.endSec ?? startSec,
      segmentRange: [chunkStartIndex, segments.length - 1],
    });
  }

  return chunks;
}

/**
 * Ensures the per-user ZeroEntropy collection exists.
 */
export async function ensureZeroEntropyCollection(userId: string): Promise<string> {
  const { apiUrl, apiKey } = getZeroEntropyConfig();
  const collectionName = `user_${userId}_videos`;

  const response = await fetch(`${apiUrl}/collections/add-collection`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ collection_name: collectionName }),
  });

  if (!response.ok) {
    const body = await response.text();
    if (!body.includes("already exists")) {
      throw new Error(`ZeroEntropy collection creation failed: ${body}`);
    }
  }

  return collectionName;
}

/**
 * Uploads prepared text chunks to ZeroEntropy.
 */
export async function uploadChunksToZeroEntropy(
  chunks: TranscriptChunk[],
  videoReference: string,
  userId: string,
): Promise<{ success: number; failed: number }> {
  const { apiUrl, apiKey } = getZeroEntropyConfig();
  const collectionName = `user_${userId}_videos`;

  let success = 0;
  let failed = 0;

  for (const chunk of chunks) {
    const body = {
      collection_name: collectionName,
      path: `video_${videoReference}_chunk_${chunk.index}.txt`,
      content: { type: "text", text: chunk.text },
      metadata: {
        videoId: String(videoReference),
        startSec: chunk.startSec.toFixed(3),
        endSec: chunk.endSec.toFixed(3),
      },
      overwrite: false,
    };

    const response = await fetch(`${apiUrl}/documents/add-document`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      failed += 1;
      const txt = await response.text();
      console.error(`[ZeroEntropy] Upload chunk #${chunk.index} ->`, txt);
    } else {
      success += 1;
    }
  }

  return { success, failed };
}

/**
 * Waits until ZeroEntropy finishes indexing the uploaded chunks.
 */
export async function waitForIndexing(collectionName: string): Promise<ZeroEntropyStatusResponse> {
  const { apiUrl, apiKey } = getZeroEntropyConfig();

  const startTime = Date.now();
  const TIMEOUT = 5 * 60 * 1000; // 5 minutes

  while (true) {
    if (Date.now() - startTime > TIMEOUT) {
      throw new Error("Indexing timeout after 5 minutes");
    }

    const response = await fetch(`${apiUrl}/status/get-status`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ collection_name: collectionName }),
    });

    if (!response.ok) {
      const txt = await response.text();
      throw new Error(`ZeroEntropy status check failed: ${txt}`);
    }

    const data = (await response.json()) as ZeroEntropyStatusResponse;
    const { num_documents, num_indexed_documents, num_failed_documents } = data;

    if (
      num_documents > 0 &&
      num_indexed_documents === num_documents &&
      num_failed_documents === 0
    ) {
      return data;
    }

    await new Promise<void>((resolve) => setTimeout(resolve, 4000));
  }
}

/**
 * Full ingestion pipeline: YouTube transcript -> ZeroEntropy chunks.
 */
export async function processYoutubeVideo(
  videoUrl: string,
  userId: string,
  langs: string[] = ["en", "en-US", "fr", "fr-FR", "es"],
): Promise<{ success: true; stats: ZeroEntropyStatusResponse; lang: string }> {
  for (const lang of langs) {
    try {
      const fetchOptions = { lang, autoGenerated: true };

      let transcript: RawTranscriptSegment[] = [];
      try {
        transcript = (await YoutubeTranscript.fetchTranscript(videoUrl, fetchOptions)) as RawTranscriptSegment[];
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        throw new Error(`Failed to fetch transcript for lang=${lang}: ${msg}`);
      }

      if (!Array.isArray(transcript) || transcript.length === 0) {
        continue;
      }

      const segments = toSegments(transcript);
      if (segments.length === 0) continue;

      const chunks = chunkSegments(segments);
      if (chunks.length === 0) continue;

      const collectionName = await ensureZeroEntropyCollection(userId);
      await uploadChunksToZeroEntropy(chunks, videoUrl, userId);
      const stats = await waitForIndexing(collectionName);

      return { success: true, stats, lang };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[ZeroEntropy] Pipeline error for lang=${lang} ->`, message);
    }
  }

  throw new Error("No usable transcript found for this video");
}

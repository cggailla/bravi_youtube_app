"use client";

import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { createClient as createSupabaseClient} from "@/lib/supabase/client";
import { addYoutubeContent } from "@/app/actions/ingest";
import Image from "next/image";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  AlertTriangle,
  ArrowRight,
  BarChart2,
  CheckCircle2,
  Clock,
  Loader2,
  RefreshCcw,
  Search,
} from "lucide-react";

// --- Types
type Status = "queued" | "processing" | "ready" | "failed";

type VideoItem = {
  id: string;
  title: string;
  channelName: string;
  duration?: string;
  publishedAt?: string;
  status: Status;
  thumbnailUrl?: string;
  youtubeId: string;
};

// --- UI helpers
function IngestSubmitButton({ disabled, submitting }: { disabled: boolean; submitting: boolean }) {
  return (
    <Button type="submit" disabled={disabled || submitting} className="rounded-full shadow">
      {submitting ? "Ingesting..." : "Ingest"}
    </Button>
  );
}

function FormFeedback({ message, submitting }: { message?: string; submitting?: boolean }) {
  if (submitting) return <p className="text-sm text-primary/100">Adding video to queue...</p>;
  if (message) return <p className="text-sm text-primary/100">{message}</p>;
  return null;
}

const statusCopy: Record<
  Status,
  { label: string; badgeVariant: "default" | "secondary" | "outline" | "destructive"; icon?: ReactNode }
> = {
  queued: {
    label: "Queued",
    badgeVariant: "secondary",
    icon: <Clock className="mr-1" size={14} />,
  },
  processing: {
    label: "Processing",
    badgeVariant: "secondary",
    icon: <Loader2 className="mr-1 animate-spin" size={14} />,
  },
  ready: {
    label: "Ready",
    badgeVariant: "outline",
    icon: <CheckCircle2 className="mr-1 text-primary" size={14} />,
  },
  failed: {
    label: "Failed",
    badgeVariant: "destructive",
    icon: <AlertTriangle className="mr-1" size={14} />,
  },
};

const statusBackground: Record<Status, string> = {
  queued: "bg-amber-50/70 dark:bg-amber-500/10",
  processing: "bg-sky-50/70 dark:bg-sky-500/10",
  ready: "bg-emerald-50/70 dark:bg-emerald-500/10",
  failed: "bg-rose-50/70 dark:bg-rose-500/10",
};

const statusLabels: Record<Status, string> = {
  queued: "Queued",
  processing: "Processing",
  ready: "Ready",
  failed: "Failed",
};

// --- Main component
export default function KnowledgeBasePanel() {
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [pasteValue, setPasteValue] = useState("");

  type FormState = { message: string; error?: boolean };
  const initialFormState: FormState = { message: "" };
  // create a browser Supabase client for this client component
  const supabase = createSupabaseClient();

  // use local state for form feedback. The form's action is the server action `addYoutubeContent`.
  const [formState, setFormState] = useState<FormState>(initialFormState);
  const formAction = addYoutubeContent;
  const [submitting, setSubmitting] = useState(false);

  // submit via API route so we can show the response message in the UI
  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setFormState(initialFormState);
    try {
      const res = await fetch('/api/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ url: pasteValue }),
      });
      const json = await res.json();
      setFormState({ message: String(json?.message ?? ''), error: Boolean(json?.error) });
      if (!json?.error) {
        setPasteValue('');
      }
    } catch (err) {
      console.error('[Client] ingest submit failed', err);
      setFormState({ message: 'Failed to submit', error: true });
    } finally {
      setSubmitting(false);
    }
  }

  // --- Helpers: normalize DB rows (snake_case) to VideoItem expected by UI
  function mapStatus(dbStatus?: string): Status {
    if (!dbStatus) return "queued";
    const s = dbStatus.toString().toLowerCase();
    if (s.includes("queued")) return "queued";
    if (s.includes("process")) return "processing";
    if (s.includes("ready")) return "ready";
    if (s.includes("fail")) return "failed";
    return "queued";
  }

  function formatDuration(seconds?: number | null) {
    if (!seconds && seconds !== 0) return undefined;
    const s = Number(seconds) || 0;
    const mins = Math.floor(s / 60);
    const secs = s % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  }

  function normalizeVideo(row: any): VideoItem {
    // defensive getters: try multiple key variants
    const get = (obj: any, ...keys: string[]) => {
      for (const k of keys) {
        if (obj == null) continue;
        if (k in obj && obj[k] !== undefined && obj[k] !== null) return obj[k];
        // also try lowercase key
        const lk = k.toLowerCase();
        if (lk in obj && obj[lk] !== undefined && obj[lk] !== null) return obj[lk];
      }
      return undefined;
    };

    const youtubeId = String(get(row, 'youtube_id', 'youtubeId', 'youtubeid', 'youtube_id_raw') ?? '').trim();
    const title = String(get(row, 'title', 'name', 'video_title') ?? (youtubeId ? `YouTube ${youtubeId}` : 'Untitled'));
    const channelName = String(get(row, 'channel_name', 'channelName', 'channel') ?? 'Unknown');
    const thumbnailUrlRaw = get(row, 'thumbnail_url', 'thumbnailUrl', 'thumbnail');
    const thumbnailUrl = thumbnailUrlRaw
      ? String(thumbnailUrlRaw)
      : youtubeId
      ? `https://img.youtube.com/vi/${youtubeId}/mqdefault.jpg`
      : undefined;
    const durationSeconds = get(row, 'duration', 'duration_seconds', 'durationSeconds');
    const duration = formatDuration(durationSeconds ?? null);
    const publishedAt = get(row, 'created_at', 'createdAt', 'published_at', 'publishedAt');
    const normalized: VideoItem = {
      id: String(get(row, 'id', 'video_id') ?? ''),
      title,
      channelName,
      duration,
      publishedAt: publishedAt ? new Date(publishedAt).toISOString() : undefined,
      status: mapStatus(String(get(row, 'status') ?? 'queued')),
      thumbnailUrl: thumbnailUrl ?? undefined,
      youtubeId: youtubeId ?? '',
    };

    // debug log to help trace missing fields (will appear in browser console)
    try {
      // eslint-disable-next-line no-console
      console.debug('[KB] normalizeVideo input:', row, 'normalized:', normalized);
    } catch (err) {}

    return normalized;
  }

  // --- Load initial videos + subscribe to realtime updates
  useEffect(() => {
    async function loadVideos() {
      const { data, error } = await supabase
        .from("videos")
        .select("*")
        .order("created_at", { ascending: false });

      if (!error && data) {
        setVideos((data as any[]).map(normalizeVideo));
      }
      setLoading(false);
    }

    loadVideos();
    // realtime subscription with a polling fallback
    let lastRealtimeEvent = Date.now();

    const channel = supabase
      .channel("videos-updates")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "videos" },
        async (payload) => {
          console.log("[Realtime] video change:", payload);
          lastRealtimeEvent = Date.now();
          try {
            if (payload.eventType === "INSERT" || payload.eventType === "UPDATE") {
              // fetch fresh row from DB to ensure we have all fields in the same shape
              const id = payload.new?.id ?? payload.new?.video_id ?? null;
              const youtube_id = payload.new?.youtube_id ?? payload.new?.youtubeId ?? null;
              let freshRow = null;
              try {
                if (id) {
                  const { data: single, error: singleErr } = await supabase.from('videos').select('*').eq('id', id).single();
                  if (!singleErr && single) freshRow = single;
                }
                if (!freshRow && youtube_id) {
                  const { data: byYt, error: byYtErr } = await supabase.from('videos').select('*').eq('youtube_id', youtube_id).limit(1);
                  if (!byYtErr && Array.isArray(byYt) && byYt.length) freshRow = byYt[0];
                }
              } catch (fetchErr) {
                console.warn('[Realtime] failed to fetch fresh row', fetchErr);
              }

              if (freshRow) {
                setVideos((prev) => {
                  if (payload.eventType === 'INSERT') return [normalizeVideo(freshRow), ...prev];
                  return prev.map((v) => (v.id === String(freshRow.id) ? normalizeVideo(freshRow) : v));
                });
              } else {
                // fallback: try to normalize payload.new directly
                setVideos((prev) => {
                  if (payload.eventType === 'INSERT') return [normalizeVideo(payload.new), ...prev];
                  return prev.map((v) => (v.id === String(payload.new?.id ?? payload.new?.video_id) ? normalizeVideo(payload.new) : v));
                });
              }
            } else if (payload.eventType === "DELETE") {
              setVideos((prev) => prev.filter((v) => v.id !== String(payload.old?.id ?? payload.old?.video_id)));
            }
          } catch (err) {
            console.error("[Realtime] error applying payload", err);
          }
        },
      )
      .subscribe();

    // polling fallback: if no realtime event received for 15s, refresh list
    const POLL_MS = 15000;
    const pollInterval = setInterval(async () => {
      if (Date.now() - lastRealtimeEvent > POLL_MS) {
        console.log("[Realtime fallback] no realtime events; polling latest videos");
        try {
          const { data, error } = await supabase
            .from("videos")
            .select("*")
            .order("created_at", { ascending: false });
          if (!error && data) {
            setVideos((data as any[]).map(normalizeVideo));
            lastRealtimeEvent = Date.now();
          }
        } catch (err) {
          console.error("[Realtime fallback] polling failed", err);
        }
      }
    }, POLL_MS);

    return () => {
      clearInterval(pollInterval);
      try {
        supabase.removeChannel(channel);
      } catch (err) {
        // some supabase clients throw on removeChannel if already removed
      }
    };
  }, []);

  // --- Format / filter / group
  const formattedVideos = useMemo(() => {
    return videos.map((v) => ({
      ...v,
      publishedAt: v.publishedAt
        ? new Date(v.publishedAt).toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
            year: "numeric",
          })
        : "—",
      thumbnailUrl: v.thumbnailUrl || `https://img.youtube.com/vi/${v.youtubeId}/mqdefault.jpg`,
    }));
  }, [videos]);

  const filteredVideos = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return formattedVideos;
    return formattedVideos.filter((video) =>
      [video.title, video.channelName].some((field) => field.toLowerCase().includes(q)),
    );
  }, [query, formattedVideos]);

  const groupedVideos = useMemo(() => {
    const groups: Record<Status, VideoItem[]> = { queued: [], processing: [], ready: [], failed: [] };
    filteredVideos.forEach((v) => groups[v.status]?.push(v));
    return groups;
  }, [filteredVideos]);

  const stats = useMemo(() => {
    const totalQueued = groupedVideos.queued.length;
    const totalProcessing = groupedVideos.processing.length;
    const totalReady = groupedVideos.ready.length;
    const totalFailed = groupedVideos.failed.length;
    return {
      totalQueued,
      totalProcessing,
      totalReady,
      totalFailed,
      total: totalQueued + totalProcessing + totalReady + totalFailed,
    };
  }, [groupedVideos]);

  // --- Selection handlers
  function toggleSelect(id: string) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]));
  }

  function clearSelection() {
    setSelected([]);
  }

  function handleUseAsContext() {
    console.log("Use as context", selected);
  }

  function handleRetry(video: VideoItem) {
    console.log("Retry ingestion", video.id);
  }

  // --- Render
  return (
    <div className="flex h-full flex-1 flex-col gap-4 overflow-hidden min-h-0">
      {/* Ingestion input */}
      <div className="rounded-3xl border border-primary/25 bg-primary/10 backdrop-blur-md p-5 shadow-lg">
        <form onSubmit={handleSubmit} className="flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <Input
              name="url"
              placeholder="Paste YouTube video or channel URL"
              value={pasteValue}
              onChange={(event) => setPasteValue(event.target.value)}
              className="flex-1 bg-white text-foreground"
            />
            <IngestSubmitButton disabled={!pasteValue.trim()} submitting={submitting} />
          </div>
          <FormFeedback message={formState?.message} submitting={submitting} />
        </form>
        <p className="mt-3 text-sm text-primary/100">
          Video URLs ingest a single video. Channel URLs ingest the latest 10 videos and queue them for processing.
        </p>
      </div>

      {/* Search + toolbar */}
      <div className="flex flex-col gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search videos or channels"
            className="pl-9"
          />
        </div>
        {selected.length > 0 && (
          <div className="flex items-center justify-between rounded-xl bg-secondary/80 px-4 py-2 text-sm">
            <span className="text-sm text-secondary-foreground">
              {selected.length} video{selected.length > 1 ? "s" : ""} selected
            </span>
            <div className="flex items-center gap-2">
              <Button size="sm" className="rounded-full" onClick={handleUseAsContext}>
                Use as Context
              </Button>
              <Button variant="ghost" size="sm" className="rounded-full" onClick={clearSelection}>
                Clear Selection
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Stats banner */}
      <div className="rounded-2xl border border-muted bg-background/90 backdrop-blur px-4 py-3 shadow-md">
        <div className="flex items-center gap-3 text-muted-foreground text-sm">
          <div className="flex items-center gap-2 font-medium text-foreground">
            <BarChart2 size={16} /> Overview
            <span className="text-xs text-muted-foreground">{stats.total} indexed</span>
          </div>
          <div className="ml-auto flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-200">
              <CheckCircle2 size={14} /> {stats.totalReady} ready
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-sky-100 px-2.5 py-1 text-xs font-medium text-sky-700 dark:bg-sky-500/10 dark:text-sky-200">
              <Loader2 className="animate-spin" size={14} /> {stats.totalProcessing + stats.totalQueued} in queue
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2.5 py-1 text-xs font-medium text-rose-700 dark:bg-rose-500/10 dark:text-rose-200">
              <AlertTriangle size={14} /> {stats.totalFailed} failed
            </span>
          </div>
        </div>
      </div>

      {/* Video list */}
      {loading ? (
        <div className="flex flex-1 items-center justify-center text-muted-foreground text-sm">Loading videos...</div>
      ) : (
        <ScrollArea className="flex-1 min-h-0 rounded-2xl border border-muted bg-background/70 backdrop-blur-sm">
          <div className="space-y-6 p-4">
            {(["queued", "processing", "ready", "failed"] as Status[]).map((status) => {
              const sectionVideos = groupedVideos[status];
              if (!sectionVideos.length) return null;
              const statusMeta = statusCopy[status];
              return (
                <section key={status} className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                      {statusLabels[status]}
                    </h3>
                    <Badge variant={statusMeta.badgeVariant} className="gap-1 capitalize">
                      {statusMeta.icon}
                      {sectionVideos.length}
                    </Badge>
                  </div>
                  <div className="space-y-3">
                    {sectionVideos.map((video) => {
                      const isSelected = selected.includes(video.id);
                      const statusInfo = statusCopy[video.status];
                      return (
                        <div
                          key={video.id}
                          className={`group relative flex items-start gap-4 rounded-xl border border-border/80 px-4 py-3 transition-all hover:shadow-lg ${statusBackground[video.status]}`}
                        >
                          <div className="pt-1">
                            <Checkbox checked={isSelected} onCheckedChange={() => toggleSelect(video.id)} />
                          </div>
                          <div className="relative aspect-video w-24 overflow-hidden rounded-lg border border-border/60 shadow-sm">
                            <Image
                              src={video.thumbnailUrl ?? ""}
                              alt={video.title}
                              fill
                              className="object-cover"
                              sizes="180px"
                            />
                          </div>
                          <div className="min-w-0 flex-1 space-y-2">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0 space-y-1">
                                <p className="font-medium text-foreground">{video.title}</p>
                                <p className="truncate text-sm text-muted-foreground">
                                  {video.channelName} • {video.publishedAt}
                                </p>
                                <p className="text-xs text-muted-foreground/80">
                                  Duration: {video.duration || "—"}
                                </p>
                              </div>
                              <Badge variant={statusInfo.badgeVariant} className="capitalize">
                                {statusInfo.icon}
                                {statusInfo.label}
                              </Badge>
                            </div>
                            {video.status === "failed" && (
                              <div className="flex items-center gap-2 text-xs text-destructive">
                                Ingestion failed.
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="gap-1"
                                  onClick={() => handleRetry(video)}
                                >
                                  <RefreshCcw size={12} /> Retry
                                </Button>
                              </div>
                            )}
                            {video.status === "ready" && (
                              <div className="flex items-center gap-1 text-xs text-primary">
                                Ready for chat context <ArrowRight size={12} />
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              );
            })}
            {filteredVideos.length === 0 && (
              <div className="px-4 py-12 text-center text-sm text-muted-foreground">
                No videos match “{query}”. Try another keyword.
              </div>
            )}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}

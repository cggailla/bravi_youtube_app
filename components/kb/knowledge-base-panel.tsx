"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
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

function IngestSubmitButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={disabled || pending} className="rounded-full shadow">
      {pending ? "Ingesting..." : "Ingest"}
    </Button>
  );
}

function FormFeedback({ message }: { message?: string }) {
  const { pending } = useFormStatus();
  if (pending) return <p className="text-sm text-primary/100">Adding video to queue...</p>;
  if (message) return <p className="text-sm text-primary/100">{message}</p>;
  return null;
}

type Status = "queued" | "processing" | "ready" | "failed";

type VideoItem = {
  id: string;
  title: string;
  channel: string;
  duration: string;
  publishedAt: string;
  status: Status;
  thumbnail: string;
};

const dummyVideos: VideoItem[] = [
  {
    id: "v1",
    title: "Mastering ZeroEntropy RAG Pipelines",
    channel: "Bravi Labs",
    duration: "18:42",
    publishedAt: "Oct 20, 2025",
    status: "ready",
    thumbnail: "https://img.youtube.com/vi/dQw4w9WgXcQ/mqdefault.jpg",
  },
  {
    id: "v2",
    title: "Channel sync: Top 10 product launches",
    channel: "Launch Radar",
    duration: "12:03",
    publishedAt: "Oct 18, 2025",
    status: "processing",
    thumbnail: "https://img.youtube.com/vi/lTTajzrSkCw/mqdefault.jpg",
  },
  {
    id: "v3",
    title: "Deep-dive: Supabase Auth with Prisma",
    channel: "Fullstack Notes",
    duration: "26:55",
    publishedAt: "Oct 15, 2025",
    status: "queued",
    thumbnail: "https://img.youtube.com/vi/E7wJTI-1dvQ/mqdefault.jpg",
  },
  {
    id: "v4",
    title: "Workshop replay: Inngest for async ingestion",
    channel: "Inngest",
    duration: "44:10",
    publishedAt: "Oct 11, 2025",
    status: "failed",
    thumbnail: "https://img.youtube.com/vi/9bZkp7q19f0/mqdefault.jpg",
  },
  {
    id: "v5",
    title: "YouTube channel: AI Product Sprint (last 10 videos)",
    channel: "AI Product Sprint",
    duration: "Batch",
    publishedAt: "Oct 01, 2025",
    status: "ready",
    thumbnail: "https://img.youtube.com/vi/tAGnKpE4NCI/mqdefault.jpg",
  },
];

const statusCopy: Record<Status, { label: string; badgeVariant: "default" | "secondary" | "outline" | "destructive"; icon?: JSX.Element }> = {
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

export default function KnowledgeBasePanel() {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [pasteValue, setPasteValue] = useState("");

  // Server Action wiring with useActionState
  type FormState = { message: string; error?: boolean };
  const initialFormState: FormState = { message: "" };
  const [formState, formAction] = useActionState(addYoutubeContent, initialFormState);
  useEffect(() => {
    if (formState?.message) {
      console.log("[KB][FormState]", formState);
    }
  }, [formState]);

  const filteredVideos = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return dummyVideos;
    return dummyVideos.filter((video) =>
      [video.title, video.channel].some((field) => field.toLowerCase().includes(q)),
    );
  }, [query]);

  const groupedVideos = useMemo(() => {
    const groups: Record<Status, VideoItem[]> = {
      queued: [],
      processing: [],
      ready: [],
      failed: [],
    };
    filteredVideos.forEach((video) => {
      groups[video.status].push(video);
    });
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

  function toggleSelect(id: string) {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  }

  function clearSelection() {
    setSelected([]);
  }

  function handleUseAsContext() {
    // TODO: Connect to server action to scope chat to selected videos
    console.log("Use as context", selected);
  }

  function handleRetry(video: VideoItem) {
    // TODO: Trigger ingestion retry via server action
    console.log("Retry ingestion", video.id);
  }

  return (
    <div className="flex h-full flex-1 flex-col gap-4 overflow-hidden min-h-0">
      {/* Ingestion input */}
      <div className="rounded-3xl border border-primary/25 bg-primary/10 backdrop-blur-md p-5 shadow-lg">
        <form action={formAction} className="flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <Input
              name="url"
              placeholder="Paste YouTube video or channel URL"
              value={pasteValue}
              onChange={(event) => setPasteValue(event.target.value)}
              className="flex-1 bg-white text-foreground"
            />
            <IngestSubmitButton disabled={!pasteValue.trim()} />
          </div>
          <FormFeedback message={formState?.message} />
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
                            src={video.thumbnail}
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
                                {video.channel} • {video.publishedAt}
                              </p>
                              <p className="text-xs text-muted-foreground/80">Duration: {video.duration}</p>
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
                                size="xs"
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
    </div>
  );
}

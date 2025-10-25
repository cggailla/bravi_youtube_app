"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ArrowUpRight, Mic, Plus, Send, Wand2 } from "lucide-react";

type Message = { id: string; role: "user" | "ai"; content: string; ts: number };

function useAutosize(ref: React.RefObject<HTMLTextAreaElement>, value: string) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "0px";
    const next = Math.min(el.scrollHeight, 6 * 24 + 16); // up to ~6 rows
    el.style.height = next + "px";
  }, [ref, value]);
}

export function CenterChat() {
  const [messages, setMessages] = useState<Message[]>([
    { id: "m1", role: "user", content: "Hello!", ts: Date.now() - 20000 },
    {
      id: "m2",
      role: "ai",
      content:
        "**Hi there!**\n\nI can help with:\n- Summaries\n- Citations with timestamps\n\n`Try asking about a specific video.`",
      ts: Date.now() - 18000,
    },
  ]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const endRef = useRef<HTMLDivElement | null>(null);
  const taRef = useRef<HTMLTextAreaElement | null>(null);
  useAutosize(taRef, input);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, thinking]);

  const canSend = input.trim().length > 0 && !thinking;

  function simulateStreaming(prepared: string) {
    setThinking(true);
    const id = crypto.randomUUID();
    setMessages((prev) => [...prev, { id, role: "ai", content: "", ts: Date.now() }]);
    const tokens = prepared.split(/(\s+)/); // keep spaces for natural flow
    let i = 0;
    const interval = setInterval(() => {
      i++;
      setMessages((prev) =>
        prev.map((m) => (m.id === id ? { ...m, content: tokens.slice(0, i).join("") } : m)),
      );
      if (i >= tokens.length) {
        clearInterval(interval);
        setThinking(false);
      }
    }, 20);
  }

  function renderInline(text: string): JSX.Element[] {
    const parts: JSX.Element[] = [];
    const regex = /(\*\*[^*]+\*\*|`[^`]+`)/g;
    let lastIndex = 0; let m: RegExpExecArray | null;
    while ((m = regex.exec(text))) {
      if (m.index > lastIndex) parts.push(<span key={lastIndex}>{text.slice(lastIndex, m.index)}</span>);
      const token = m[0];
      if (token.startsWith("**")) {
        parts.push(<strong key={m.index}>{token.slice(2, -2)}</strong>);
      } else if (token.startsWith("`")) {
        parts.push(<code key={m.index} className="px-1 py-0.5 rounded bg-muted font-mono text-sm">{token.slice(1, -1)}</code>);
      }
      lastIndex = m.index + token.length;
    }
    if (lastIndex < text.length) parts.push(<span key={lastIndex}>{text.slice(lastIndex)}</span>);
    return parts;
  }

  function renderMarkdown(md: string) {
    const elements: JSX.Element[] = [];
    const lines = md.split(/\n/);
    let i = 0;
    while (i < lines.length) {
      const line = lines[i];
      if (line.startsWith("```")) {
        let code = ""; i++;
        while (i < lines.length && !lines[i].startsWith("```")) { code += lines[i] + "\n"; i++; }
        if (i < lines.length && lines[i].startsWith("```")) i++;
        elements.push(
          <pre key={`code-${i}`} className="mt-2 mb-3 rounded-md bg-muted p-3 overflow-auto text-sm">
            <code className="font-mono">{code}</code>
          </pre>
        );
        continue;
      }
      if (line.startsWith("- ")) {
        const items: string[] = [];
        while (i < lines.length && lines[i].startsWith("- ")) { items.push(lines[i].slice(2)); i++; }
        elements.push(
          <ul key={`ul-${i}`} className="list-disc pl-6 my-2 space-y-1">
            {items.map((it, idx) => (
              <li key={idx}>{renderInline(it)}</li>
            ))}
          </ul>
        );
        continue;
      }
      const h = line.match(/^(#{1,3})\s+(.*)$/);
      if (h) {
        const level = h[1].length; const text = h[2];
        const Tag = (level === 1 ? 'h2' : level === 2 ? 'h3' : 'h4') as any;
        elements.push(<Tag key={`h-${i}`} className="font-semibold mt-2 mb-1">{renderInline(text)}</Tag>);
        i++; continue;
      }
      if (line.trim().length === 0) { elements.push(<div key={`sp-${i}`} className="h-2" />); i++; continue; }
      elements.push(<p key={`p-${i}`} className="leading-7">{renderInline(line)}</p>);
      i++;
    }
    return <div className="space-y-1">{elements}</div>;
  }

  function handleSend() {
    if (!canSend) return;
    const text = input.trim();
    setInput("");
    const userMsg: Message = { id: crypto.randomUUID(), role: "user", content: text, ts: Date.now() };
    setMessages((prev) => [...prev, userMsg]);

    const prepared = [
      "# Prepared answer (demo)",
      "",
      "This is a placeholder we will replace with a real streamed response.",
      "",
      "## Next steps",
      "- Plug a Server Action or route handler",
      "- Return tokens as they arrive to stream UI",
      "- Attach sources with timecodes",
      "",
      "```ts",
      "// example to replace later",
      "async function ask(question: string) {",
      "  return 'stream';",
      "}",
      "```",
    ].join("\n");

    simulateStreaming(prepared);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  const showEmptyHero = useMemo(() => messages.length === 0, [messages.length]);

  return (
    <div className="h-full flex flex-col">
      {/* Scope Bar */}
      <div className="h-12 border-b bg-muted/20 backdrop-blur-sm flex items-center justify-between px-4 text-sm">
        <div className="flex items-center gap-2 overflow-x-auto">
          <span className="text-muted-foreground">Scope:</span>
          <Badge variant="secondary" className="rounded-full">All videos</Badge>
          <Badge variant="outline" className="rounded-full">This channel</Badge>
          <Badge variant="outline" className="rounded-full">Last 30 days</Badge>
        </div>
        <Button variant="ghost" size="sm" className="gap-1 text-muted-foreground hover:text-foreground">
          <Wand2 size={14} /> Reset
        </Button>
      </div>

      {/* Messages */}
      <div className="flex-1 min-h-0">
        <ScrollArea className="h-full">
          <div className="px-4 md:px-6 py-6 space-y-5 mx-auto md:max-w-3xl">
            {showEmptyHero ? (
              <div className="h-[60vh] grid place-items-center">
                <div className="text-center space-y-4">
                  <h2 className="text-2xl md:text-3xl font-semibold tracking-tight">What’s on the agenda today?</h2>
                  <p className="text-sm text-muted-foreground max-w-md mx-auto">Ask about your YouTube knowledge base. Query transcripts, cite sources, and get time-stamped answers.</p>
                </div>
              </div>
            ) : null}

            {messages.map((m) => (
              <div key={m.id} className={`flex items-start gap-3 ${m.role === "user" ? "justify-end" : "justify-center"}`}>
                {m.role === "ai" && (
                  <Avatar className="size-7 shadow-sm ring-1 ring-border/60">
                    <AvatarFallback>AI</AvatarFallback>
                  </Avatar>
                )}
                <div
                  className={
                    m.role === "user"
                      ? "self-end bg-muted text-foreground p-3 rounded-2xl rounded-tr-sm max-w-[75%] w-fit shadow-sm"
                      : "mx-auto max-w-[65ch] w-full text-center md:text-left text-foreground"
                  }
                >
                  {m.role === "ai" ? renderMarkdown(m.content) : m.content}
                </div>
                {m.role === "user" && (
                  <Avatar className="size-7 shadow-sm ring-1 ring-border/60">
                    <AvatarFallback>U</AvatarFallback>
                  </Avatar>
                )}
              </div>
            ))}

            {thinking && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground" aria-live="polite">
                <span className="size-2 rounded-full bg-muted-foreground animate-pulse" />
                AI is typing…
              </div>
            )}
            <div ref={endRef} />
          </div>
        </ScrollArea>
      </div>

      {/* Composer */}
      <div className="border-t p-3 md:p-4 shrink-0 bg-gradient-to-t from-muted/30 to-transparent">
        <div className="mx-auto flex items-end gap-2 rounded-2xl border border-muted bg-background/80 backdrop-blur px-3 py-2 shadow-md md:max-w-3xl">
          <Button variant="ghost" size="icon" className="rounded-full text-muted-foreground hover:text-foreground">
            <Plus size={16} />
          </Button>
          <textarea
            ref={taRef}
            rows={1}
            placeholder="Ask anything…"
            className="max-h-40 w-full resize-none border-0 bg-transparent focus-visible:ring-0 focus-visible:outline-none flex-1 leading-6"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <Button variant="ghost" size="icon" className="rounded-full text-muted-foreground hover:text-foreground">
            <Mic size={16} />
          </Button>
          <Button
            variant="default"
            size="icon"
            className="rounded-full shadow"
            disabled={!canSend}
            onClick={handleSend}
          >
            <Send size={16} />
          </Button>
        </div>
        <div className="mx-auto md:max-w-3xl px-4 mt-2">
          <p className="text-xs text-muted-foreground">
            Responses will cite sources with timestamps. <span className="inline-flex items-center gap-1">Learn more <ArrowUpRight size={12} /></span>
          </p>
        </div>
      </div>
    </div>
  );
}

export default CenterChat;

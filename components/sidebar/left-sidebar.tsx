"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { LogoutButton } from "@/components/logout-button";
import { Plus, Pencil, Trash2 } from "lucide-react";

type Conversation = { id: string; title: string };

const dummyConversations: Conversation[] = [
  { id: "1", title: "Pricing Strategies Discussion" },
  { id: "2", title: "Claude Code Best Practices" },
  { id: "3", title: "Learnings summary" },
  { id: "4", title: "YouTube ingestion backlog" },
  { id: "5", title: "RAG prompt shaping" },
];

export default function LeftSidebar({ userEmail }: { userEmail?: string }) {
  const [currentId, setCurrentId] = useState<string>("2");
  const conversations = useMemo(() => dummyConversations, []);

  function handleNewChat() {
    // TODO: server action to create chat
    // For now, pick a temp id and push to list (skipped: immutable demo)
    console.log("New Chat Clicked");
  }

  function handleSelect(id: string) {
    // TODO: load messages + scope for id
    setCurrentId(id);
    console.log("Selected Conversation:", id);
  }

  return (
    <div className="flex h-full flex-col text-[0.95rem] md:text-base">
      {/* Header */}
      <div className="mb-3 shrink-0">
        <Button onClick={handleNewChat} className="w-full justify-center rounded-full shadow text-[0.95rem]" size="sm">
          <Plus className="mr-1.5" size={16} /> New Chat
        </Button>
      </div>

      {/* Conversation List */}
      <ScrollArea className="flex-1 pr-2">
        <div className="space-y-1.5">
          {conversations.map((c) => {
            const active = c.id === currentId;
            return (
              <div
                key={c.id}
                className={
                  `relative group rounded-lg px-3 py-2 text-[0.95rem] md:text-base flex items-center justify-between cursor-pointer ` +
                  (active ? "bg-secondary ring-1 ring-border" : "hover:bg-muted/60")
                }
                onClick={() => handleSelect(c.id)}
                role="button"
                tabIndex={0}
              >
                <div className="min-w-0 flex-1">
                  <div className={`truncate ${active ? "font-medium" : "text-foreground"}`}>{c.title}</div>
                </div>
                <div className="ml-2 hidden items-center gap-1 text-muted-foreground group-hover:flex">
                  <Button variant="ghost" size="icon" className="h-7 w-7">
                    <Pencil size={14} />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7">
                    <Trash2 size={14} />
                  </Button>
                </div>
                {active && <span className="absolute inset-y-1 left-0 w-[3px] rounded-full bg-primary" />}
              </div>
            );
          })}
        </div>
      </ScrollArea>

      {/* Footer / Profile */}
      <div className="mt-3 border-t pt-3 shrink-0">
        <div className="flex items-center gap-3">
          <Avatar className="h-8 w-8">
            <AvatarFallback>{userEmail ? userEmail[0]?.toUpperCase() : "U"}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <div className="truncate text-[0.95rem] md:text-base font-medium">{userEmail ?? "user@example.com"}</div>
            <div className="text-sm text-muted-foreground">Profile · Settings</div>
          </div>
        </div>
        <LogoutButton
          variant="outline"
          size="sm"
          className="mt-3 w-full justify-center rounded-full"
        />
      </div>
    </div>
  );
}

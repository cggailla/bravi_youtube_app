import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable";
import CenterChat from "@/components/chat/center-chat";
import LeftSidebar from "@/components/sidebar/left-sidebar";
import KnowledgeBasePanel from "@/components/kb/knowledge-base-panel";

export default async function ProtectedPage() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims) {
    redirect("/auth/login");
  }

  return (
    <ResizablePanelGroup direction="horizontal" className="h-full">
      <ResizablePanel defaultSize={20}>
        <div className="h-full p-3 bg-muted/30 border-r">
          <LeftSidebar userEmail={data.claims?.email as string | undefined} />
        </div>
      </ResizablePanel>
      <ResizableHandle withHandle />
      <ResizablePanel defaultSize={50}>
        <div className="h-full bg-background"><CenterChat /></div>
      </ResizablePanel>
      <ResizableHandle withHandle />
      <ResizablePanel defaultSize={30}>
        <div className="h-full p-4 bg-muted/30 border-l flex flex-col min-h-0">
          <KnowledgeBasePanel />
        </div>
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}

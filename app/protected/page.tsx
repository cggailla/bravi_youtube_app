import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
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
    <div className="flex h-full">
      <div className="w-1/5 h-full p-3 bg-muted/30 border-r">
        <LeftSidebar userEmail={data.claims?.email as string | undefined} />
      </div>
      <div className="flex-1 h-full">
        <CenterChat />
      </div>
      <div className="w-1/4 h-full p-4 bg-muted/30 border-l flex flex-col min-h-0">
        <KnowledgeBasePanel />
      </div>
    </div>
  );
}

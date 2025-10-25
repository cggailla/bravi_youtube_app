import { AuthButton } from "@/components/auth-button";
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable";

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col">
      <header className="h-12 border-b flex items-center justify-end px-4 text-sm">
        <AuthButton />
      </header>
      <div className="flex-1">
        <ResizablePanelGroup direction="horizontal" className="h-screen">
          <ResizablePanel defaultSize={20}>
            <div className="h-full p-4">Left Sidebar (Profil/Historique)</div>
          </ResizablePanel>
          <ResizableHandle withHandle />
          <ResizablePanel defaultSize={50}>
            <div className="h-full p-4">Center (Chat)</div>
          </ResizablePanel>
          <ResizableHandle withHandle />
          <ResizablePanel defaultSize={30}>
            <div className="h-full p-4">Right (Knowledge Base)</div>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </main>
  );
}

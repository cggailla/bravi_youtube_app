import { AuthButton } from "@/components/auth-button";
export default function Home() {
  return (
    <main className="min-h-screen flex flex-col">
      <header className="h-12 border-b flex items-center justify-end px-4 text-sm">
        <AuthButton />
      </header>
      <div className="flex-1">
        <div className="flex h-screen">
          <div className="w-1/5 h-full p-4">Left Sidebar (Profil/Historique)</div>
          <div className="flex-1 h-full p-4">Center (Chat)</div>
          <div className="w-1/4 h-full p-4">Right (Knowledge Base)</div>
        </div>
      </div>
    </main>
  );
}

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="h-screen overflow-hidden">
      <div className="h-full overflow-hidden">{children}</div>
    </main>
  );
}

import { Sidebar } from "../components/Sidebar";
import { DataInitializer } from "../components/DataInitializer";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen">
      <DataInitializer />
      <Sidebar />
      <main className="flex-1 overflow-auto bg-background p-6">
        {children}
      </main>
    </div>
  );
}

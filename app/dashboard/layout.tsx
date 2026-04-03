"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Sidebar, MobileNav } from "../components/Sidebar";
import { DataInitializer } from "../components/DataInitializer";
import { useAuth } from "@/app/lib/AuthContext";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
    }
  }, [user, loading, router]);

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      <DataInitializer />
      <Sidebar />
      <main className="flex-1 overflow-auto bg-background p-6 pt-16 md:pt-6">
        {children}
      </main>
      <MobileNav />
    </div>
  );
}

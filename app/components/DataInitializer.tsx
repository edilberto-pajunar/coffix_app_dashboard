"use client";
import { useEffect } from "react";
import { useDashboardStore } from "@/app/dashboard/products/store/useDashboardStore";
import { useStoreStore } from "@/app/dashboard/stores/store/useStoreStore";

export function DataInitializer() {
  const listenToAll = useDashboardStore((s) => s.listenToAll);
  const listenToStores = useStoreStore((s) => s.listenToStores);

  useEffect(() => {
    const unsubAll = listenToAll();
    const unsubStores = listenToStores();
    return () => {
      unsubAll();
      unsubStores();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}

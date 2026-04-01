"use client";
import { useEffect } from "react";
import { useDashboardStore } from "@/app/dashboard/products/store/useDashboardStore";
import { useStoreStore } from "@/app/dashboard/stores/store/useStoreStore";
import { useUserStore } from "../dashboard/users/store/useUserStore";
import { useStaffStore } from "../dashboard/staffs/store/useStaffStore";

export function DataInitializer() {
  const listenToAll = useDashboardStore((s) => s.listenToAll);
  const listenToStores = useStoreStore((s) => s.listenToStores);
  const listenToUsers = useUserStore((s) => s.listenToUsers);
  const listenToStaffs = useStaffStore((s) => s.listenToStaffs);

  useEffect(() => {
    const unsubAll = listenToAll();
    const unsubStores = listenToStores();
    const unsubUsers = listenToUsers();
    const unsubStaffs = listenToStaffs();
    return () => {
      unsubAll();
      unsubStores();
      unsubUsers();
      unsubStaffs();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}

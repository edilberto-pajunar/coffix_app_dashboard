"use client";
import { useEffect } from "react";
import { useDashboardStore } from "@/app/dashboard/products/store/useDashboardStore";
import { useStoreStore } from "@/app/dashboard/stores/store/useStoreStore";
import { useUserStore } from "../dashboard/users/store/useUserStore";
import { useStaffStore } from "../dashboard/staffs/store/useStaffStore";
import { useGlobalSettingsStore } from "../dashboard/globalSettings/store/useGlobalSettingsStore";
import { useNotificationStore } from "../dashboard/notifications/store/useNotificationStore";
import { useEmailTemplateStore } from "../dashboard/emailTemplates/store/useEmailTemplateStore";

export function DataInitializer() {
  const listenToAll = useDashboardStore((s) => s.listenToAll);
  const listenToStores = useStoreStore((s) => s.listenToStores);
  const listenToUsers = useUserStore((s) => s.listenToUsers);
  const listenToStaffs = useStaffStore((s) => s.listenToStaffs);
  const listenToSettings = useGlobalSettingsStore((s) => s.listenToSettings);
  const listenToCampaigns = useNotificationStore((s) => s.listenToCampaigns);
  const listenToTemplates = useEmailTemplateStore((s) => s.listenToTemplates);

  useEffect(() => {
    const unsubAll = listenToAll();
    const unsubStores = listenToStores();
    const unsubUsers = listenToUsers();
    const unsubStaffs = listenToStaffs();
    const unsubSettings = listenToSettings();
    const unsubNotifications = listenToCampaigns();
    const unsubEmailTemplates = listenToTemplates();
    return () => {
      unsubAll();
      unsubStores();
      unsubUsers();
      unsubStaffs();
      unsubSettings();
      unsubNotifications();
      unsubEmailTemplates();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}

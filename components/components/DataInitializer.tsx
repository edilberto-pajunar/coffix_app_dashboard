"use client";
import { useEffect } from "react";
import { useDashboardStore } from "@/app/dashboard/products/store/useDashboardStore";
import { useStoreStore } from "@/app/dashboard/stores/store/useStoreStore";
import { useUserStore } from "@/app/dashboard/users/store/useUserStore";
import { useStaffStore } from "@/app/dashboard/staffs/store/useStaffStore";
import { useGlobalSettingsStore } from "@/app/dashboard/globalSettings/store/useGlobalSettingsStore";
import { useNotificationStore } from "@/app/dashboard/notifications/store/useNotificationStore";
import { useEmailTemplateStore } from "@/app/dashboard/emailTemplates/store/useEmailTemplateStore";
import { useTransactionStore } from "@/app/dashboard/transactions/store/useTransactionStore";
import { useCouponStore } from "@/app/dashboard/coupons/store/useCouponStore";
import { useReferralStore } from "@/app/dashboard/referrals/store/useReferralStore";

export function DataInitializer() {
  const listenToAll = useDashboardStore((s) => s.listenToAll);
  const listenToStores = useStoreStore((s) => s.listenToStores);
  const listenToUsers = useUserStore((s) => s.listenToUsers);
  const listenToStaffs = useStaffStore((s) => s.listenToStaffs);
  const listenToSettings = useGlobalSettingsStore((s) => s.listenToSettings);
  const listenToCampaigns = useNotificationStore((s) => s.listenToCampaigns);
  const listenToTemplates = useEmailTemplateStore((s) => s.listenToTemplates);
  const listenToTransactions = useTransactionStore((s) => s.listenToTransactions);
  const listenToOrders = useTransactionStore((s) => s.listenToOrders);
  const listenToCoupons = useCouponStore((s) => s.listenToCoupons);
  const listenToReferrals = useReferralStore((s) => s.listenToReferrals);

  useEffect(() => {
    const unsubAll = listenToAll();
    const unsubStores = listenToStores();
    const unsubUsers = listenToUsers();
    const unsubStaffs = listenToStaffs();
    const unsubSettings = listenToSettings();
    const unsubNotifications = listenToCampaigns();
    const unsubEmailTemplates = listenToTemplates();
    const unsubTransactions = listenToTransactions();
    const unsubOrders = listenToOrders();
    const unsubCoupons = listenToCoupons();
    const unsubReferrals = listenToReferrals();
    return () => {
      unsubAll();
      unsubStores();
      unsubUsers();
      unsubStaffs();
      unsubSettings();
      unsubNotifications();
      unsubEmailTemplates();
      unsubTransactions();
      unsubOrders();
      unsubCoupons();
      unsubReferrals();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}

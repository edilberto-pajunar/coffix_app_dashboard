import { create } from "zustand";
import { NotificationCampaign } from "../interface/notification";
import { NotificationService } from "../service/NotificationService";

interface NotificationState {
  campaigns: NotificationCampaign[];
  listenToCampaigns: () => () => void;
}

export const useNotificationStore = create<NotificationState>((set) => ({
  campaigns: [],
  listenToCampaigns: () =>
    NotificationService.listenToCampaigns((campaigns) => set({ campaigns })),
}));

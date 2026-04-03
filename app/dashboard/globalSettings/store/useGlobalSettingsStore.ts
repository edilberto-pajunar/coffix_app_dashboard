import { create } from "zustand";
import { GlobalSettings } from "../interface/global_settings";
import { GlobalSettingsService } from "../service/GlobalSettingsService";

interface GlobalSettingsState {
  settings: GlobalSettings | null;
  listenToSettings: () => () => void;
}

export const useGlobalSettingsStore = create<GlobalSettingsState>((set) => ({
  settings: null,
  listenToSettings: () =>
    GlobalSettingsService.listenToSettings((settings) => set({ settings })),
}));

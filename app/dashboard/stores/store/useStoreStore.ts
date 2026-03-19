import { create } from "zustand";
import { Store } from "../interface/store";
import { StoreService } from "../service/StoreService";

interface StoreState {
  stores: Store[];
  listenToStores: () => () => void;
}

export const useStoreStore = create<StoreState>((set) => ({
  stores: [],
  listenToStores: () => StoreService.listenToStores((stores) => set({ stores })),
}));

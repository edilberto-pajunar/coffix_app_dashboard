import { create } from "zustand";
import { Store } from "../interface/store";
import { StoreService } from "../service/StoreService";

interface StoreState {
  /** Live stores only — soft-deleted records are filtered out. */
  stores: Store[];
  /** Every store including soft-deleted ones, for resolving stale references. */
  allStores: Store[];
  listenToStores: () => () => void;
}

export const useStoreStore = create<StoreState>((set) => ({
  stores: [],
  allStores: [],
  listenToStores: () =>
    StoreService.listenToStores((stores, allStores) => set({ stores, allStores })),
}));

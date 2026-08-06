import { create } from "zustand";
import { Product } from "../interface/product";
import { Modifier } from "../interface/modifier";
import { ModifierGroup } from "../interface/modifierGroup";
import { Category } from "../interface/category";
import { ProductService } from "../service/ProductService";
import { useStoreStore } from "@/app/dashboard/stores/store/useStoreStore";

interface DashboardStore {
  products: Product[];
  /** Every product including soft-deleted ones, for resolving stale references. */
  allProducts: Product[];
  modifiers: Modifier[];
  modifierGroups: ModifierGroup[];
  /** Every modifier group including soft-deleted ones, for resolving stale references. */
  allModifierGroups: ModifierGroup[];
  categories: Category[];
  /** Every category including soft-deleted ones, for resolving stale references. */
  allCategories: Category[];
  categoriesLoaded: boolean;
  setProducts: (products: Product[]) => void;
  setModifiers: (modifiers: Modifier[]) => void;
  setModifierGroups: (modifierGroups: ModifierGroup[]) => void;
  setCategories: (categories: Category[]) => void;
  getCategoryName: (categoryId?: string) => string;
  listenToAll: () => () => void;
}

export const useDashboardStore = create<DashboardStore>((set, get) => ({
  products: [],
  allProducts: [],
  modifiers: [],
  modifierGroups: [],
  allModifierGroups: [],
  categories: [],
  allCategories: [],
  categoriesLoaded: false,
  setProducts: (products) => set({ products }),
  setModifiers: (modifiers) => set({ modifiers }),
  setModifierGroups: (modifierGroups) => set({ modifierGroups }),
  setCategories: (categories) => set({ categories }),
  getCategoryName: (categoryId) => {
    if (!categoryId) return "Uncategorized";
    return (
      get().categories.find((c) => c.docId === categoryId)?.name ??
      "Uncategorized"
    );
  },
  listenToAll: () => {
    const unsubProducts = ProductService.listenToProducts(
      (products, allProducts) => set({ products, allProducts }),
      () => useStoreStore.getState().stores.map((s) => s.docId),
    );
    const unsubCategories = ProductService.listenToCategories(
      (categories, allCategories) =>
        set({ categories, allCategories, categoriesLoaded: true }),
    );
    const unsubModifiers = ProductService.listenToModifiers((modifiers) =>
      set({ modifiers }),
    );
    const unsubModifierGroups = ProductService.listenToModifierGroups(
      (modifierGroups, allModifierGroups) =>
        set({ modifierGroups, allModifierGroups }),
    );

    return () => {
      unsubProducts();
      unsubCategories();
      unsubModifiers();
      unsubModifierGroups();
    };
  },
}));

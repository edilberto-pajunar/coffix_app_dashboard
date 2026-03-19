import { create } from "zustand";
import { Product } from "../interface/product";
import { Modifier } from "../interface/modifier";
import { ModifierGroup } from "../interface/modifierGroup";
import { Category } from "../interface/category";
import { ProductService } from "../service/ProductService";

interface DashboardStore {
  products: Product[];
  modifiers: Modifier[];
  modifierGroups: ModifierGroup[];
  categories: Category[];
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
  modifiers: [],
  modifierGroups: [],
  categories: [],
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
    const unsubProducts = ProductService.listenToProducts((products) =>
      set({ products }),
    );
    const unsubCategories = ProductService.listenToCategories((categories) =>
      set({ categories, categoriesLoaded: true }),
    );
    const unsubModifiers = ProductService.listenToModifiers((modifiers) =>
      set({ modifiers }),
    );
    const unsubModifierGroups = ProductService.listenToModifierGroups(
      (modifierGroups) => set({ modifierGroups }),
    );

    return () => {
      unsubProducts();
      unsubCategories();
      unsubModifiers();
      unsubModifierGroups();
    };
  },
}));

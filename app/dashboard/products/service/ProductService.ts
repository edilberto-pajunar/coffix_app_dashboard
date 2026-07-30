import { db } from "@/app/lib/firebase";
import {
  arrayRemove,
  arrayUnion,
  collection,
  doc,
  DocumentData,
  onSnapshot,
  QuerySnapshot,
  Unsubscribe,
  updateDoc,
  writeBatch,
} from "firebase/firestore";
import { Product } from "../interface/product";
import { Modifier } from "../interface/modifier";
import { ModifierGroup } from "../interface/modifierGroup";
import { Category } from "../interface/category";
import { createWithSequentialId } from "@/app/utils/generateId";
import { ID_PREFIXES } from "@/app/utils/constant";

function snapToArray<T>(
  snapshot: QuerySnapshot<DocumentData, DocumentData>,
): T[] {
  return snapshot.docs.map((d) => ({ ...d.data(), docId: d.id })) as T[];
}

// Firestore docs may carry legacy or hand-edited values where an array field is
// a string (or missing entirely), so coerce before the UI calls array methods.
function toStringArray(value: unknown): string[] {
  if (Array.isArray(value))
    return value.filter((v): v is string => typeof v === "string");
  if (typeof value === "string") return value ? [value] : [];
  return [];
}

// Deletes are soft: documents are retained so historical transactions can still
// resolve product names and modifier labels, so hide them from the live UI here.
function notDeleted<T extends { isDeleted?: boolean }>(items: T[]): T[] {
  return items.filter((item) => !item.isDeleted);
}

function normalizeProduct(product: Product): Product {
  return {
    ...product,
    availableToStores: toStringArray(product.availableToStores),
    disabledStores: toStringArray(product.disabledStores),
    modifierGroupIds: toStringArray(product.modifierGroupIds),
  };
}

export const ProductService = {
  listenToProducts: (onUpdate: (products: Product[]) => void): Unsubscribe =>
    onSnapshot(collection(db, "products"), (snap) =>
      onUpdate(notDeleted(snapToArray<Product>(snap)).map(normalizeProduct)),
    ),

  listenToModifiers: (onUpdate: (modifiers: Modifier[]) => void): Unsubscribe =>
    onSnapshot(collection(db, "modifiers"), (snap) =>
      onUpdate(notDeleted(snapToArray<Modifier>(snap))),
    ),

  listenToModifierGroups: (
    onUpdate: (groups: ModifierGroup[]) => void,
  ): Unsubscribe =>
    onSnapshot(collection(db, "modifierGroups"), (snap) =>
      onUpdate(notDeleted(snapToArray<ModifierGroup>(snap))),
    ),

  listenToCategories: (
    onUpdate: (categories: Category[]) => void,
  ): Unsubscribe =>
    onSnapshot(collection(db, "productCategories"), (snap) =>
      onUpdate(notDeleted(snapToArray<Category>(snap))),
    ),

  // The document ID is a sequential, human-readable code (PRD-000001) rather than a
  // random Firestore ID, allocated atomically via a counter document.
  createProduct: async (data: Omit<Product, "docId">) => {
    const key = "products";
    const docId = await createWithSequentialId(
      key,
      { ...data, createdAt: new Date(), order: 0 } as Record<string, unknown>,
      { counterKey: key, prefix: ID_PREFIXES.products },
    );
    return doc(db, key, docId);
  },

  updateProduct: (docId: string, data: Partial<Omit<Product, "docId">>) =>
    updateDoc(doc(db, "products", docId), {
      ...data,
      updatedAt: new Date(),
    } as DocumentData),

  deleteProduct: (docId: string) => {
    updateDoc(doc(db, "products", docId), {
      isDeleted: true,
      deletedAt: new Date(),
    } as DocumentData);
  },

  createModifier: async (data: Omit<Modifier, "docId">) => {
    const key = "modifiers";
    const docId = await createWithSequentialId(
      key,
      { ...data, createdAt: new Date(), order: 0 } as Record<string, unknown>,
      { counterKey: key, prefix: ID_PREFIXES.modifiers },
    );

    return doc(db, key, docId);
  },

  updateModifier: (docId: string, data: Partial<Omit<Modifier, "docId">>) =>
    updateDoc(doc(db, "modifiers", docId), {
      ...data,
      updatedAt: new Date(),
    } as DocumentData),

  deleteModifier: (docId: string) => {
    updateDoc(doc(db, "modifiers", docId), {
      isDeleted: true,
      deletedAt: new Date(),
    } as DocumentData);
  },

  createModifierGroup: async (data: Omit<ModifierGroup, "docId">) => {
    const key = "modifierGroups";
    const docId = await createWithSequentialId(
      key,
      { ...data, createdAt: new Date(), order: 0 } as Record<string, unknown>,
      { counterKey: key, prefix: ID_PREFIXES.modifierGroups },
    );

    return doc(db, key, docId);
  },

  updateModifierGroup: (
    docId: string,
    data: Partial<Omit<ModifierGroup, "docId">>,
  ) =>
    updateDoc(doc(db, "modifierGroups", docId), {
      ...data,
      updatedAt: new Date(),
    } as DocumentData),

  // Soft-deletes a modifier group along with its modifier documents and removes
  // the group ID from every product that references it — all in one atomic batch.
  // The documents are retained so historical transactions can still resolve labels.
  deleteModifierGroupCascade: async (
    groupDocId: string,
    modifierIds: string[],
    affectedProductIds: string[],
  ) => {
    const batch = writeBatch(db);
    const deletedAt = new Date();
    affectedProductIds.forEach((pid) =>
      batch.update(doc(db, "products", pid), {
        modifierGroupIds: arrayRemove(groupDocId),
        updatedAt: deletedAt,
      }),
    );
    modifierIds.forEach((mid) =>
      batch.update(doc(db, "modifiers", mid), { isDeleted: true, deletedAt }),
    );
    batch.update(doc(db, "modifierGroups", groupDocId), {
      isDeleted: true,
      deletedAt,
    });
    await batch.commit();
  },

  createCategory: async (data: Omit<Category, "docId">) => {
    const key = "productCategories";
    const docId = await createWithSequentialId(
      key,
      { ...data, createdAt: new Date(), order: 0 } as Record<string, unknown>,
      { counterKey: key, prefix: ID_PREFIXES.productCategories },
    );

    return doc(db, key, docId);
  },

  updateCategory: (docId: string, data: Partial<Omit<Category, "docId">>) =>
    updateDoc(doc(db, "productCategories", docId), {
      ...data,
      updatedAt: new Date(),
    } as DocumentData),

  deleteCategory: (docId: string) => {
    updateDoc(doc(db, "productCategories", docId), {
      isDeleted: true,
      deletedAt: new Date(),
    } as DocumentData);
  },

  addModifierToGroup: (groupDocId: string, modifierDocId: string) =>
    updateDoc(doc(db, "modifierGroups", groupDocId), {
      modifierIds: arrayUnion(modifierDocId),
    }),

  removeModifierFromGroup: (groupDocId: string, modifierDocId: string) =>
    updateDoc(doc(db, "modifierGroups", groupDocId), {
      modifierIds: arrayRemove(modifierDocId),
    }),
};

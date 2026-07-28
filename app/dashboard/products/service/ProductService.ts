import { db } from "@/app/lib/firebase";
import {
  arrayRemove,
  arrayUnion,
  collection,
  deleteDoc,
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
      onUpdate(snapToArray<Product>(snap).map(normalizeProduct)),
    ),

  listenToModifiers: (onUpdate: (modifiers: Modifier[]) => void): Unsubscribe =>
    onSnapshot(collection(db, "modifiers"), (snap) =>
      onUpdate(snapToArray<Modifier>(snap)),
    ),

  listenToModifierGroups: (
    onUpdate: (groups: ModifierGroup[]) => void,
  ): Unsubscribe =>
    onSnapshot(collection(db, "modifierGroups"), (snap) =>
      onUpdate(snapToArray<ModifierGroup>(snap)),
    ),

  listenToCategories: (
    onUpdate: (categories: Category[]) => void,
  ): Unsubscribe =>
    onSnapshot(collection(db, "productCategories"), (snap) =>
      onUpdate(snapToArray<Category>(snap)),
    ),

  // The document ID is a sequential, human-readable code (PRD-000001) rather than a
  // random Firestore ID, allocated atomically via a counter document.
  createProduct: async (data: Omit<Product, "docId">) => {
    const key = "products";
    const docId = await createWithSequentialId(
      key,
      { ...data, createdAt: new Date() } as Record<string, unknown>,
      { counterKey: key, prefix: ID_PREFIXES.products },
    );
    return doc(db, key, docId);
  },

  updateProduct: (docId: string, data: Partial<Omit<Product, "docId">>) =>
    updateDoc(doc(db, "products", docId), {
      ...data,
      updatedAt: new Date(),
    } as DocumentData),

  deleteProduct: (docId: string) => deleteDoc(doc(db, "products", docId)),

  createModifier: async (data: Omit<Modifier, "docId">) => {
    const key = "modifiers";
    const docId = await createWithSequentialId(
      key,
      { ...data, createdAt: new Date() } as Record<string, unknown>,
      { counterKey: key, prefix: ID_PREFIXES.modifiers },
    );

    return doc(db, key, docId);
  },

  updateModifier: (docId: string, data: Partial<Omit<Modifier, "docId">>) =>
    updateDoc(doc(db, "modifiers", docId), {
      ...data,
      updatedAt: new Date(),
    } as DocumentData),

  deleteModifier: (docId: string) => deleteDoc(doc(db, "modifiers", docId)),

  createModifierGroup: async (data: Omit<ModifierGroup, "docId">) => {
    const key = "modifierGroups";
    const docId = await createWithSequentialId(
      key,
      { ...data, createdAt: new Date() } as Record<string, unknown>,
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

  // Deletes a modifier group along with its modifier documents and removes the
  // group ID from every product that references it — all in one atomic batch.
  deleteModifierGroupCascade: async (
    groupDocId: string,
    modifierIds: string[],
    affectedProductIds: string[],
  ) => {
    const batch = writeBatch(db);
    affectedProductIds.forEach((pid) =>
      batch.update(doc(db, "products", pid), {
        modifierGroupIds: arrayRemove(groupDocId),
      }),
    );
    modifierIds.forEach((mid) => batch.delete(doc(db, "modifiers", mid)));
    batch.delete(doc(db, "modifierGroups", groupDocId));
    await batch.commit();
  },

  createCategory: async (data: Omit<Category, "docId">) => {
    const key = "productCategories";
    const docId = await createWithSequentialId(
      key,
      { ...data, createdAt: new Date() } as Record<string, unknown>,
      { counterKey: key, prefix: ID_PREFIXES.productCategories },
    );

    return doc(db, key, docId);
  },

  updateCategory: (docId: string, data: Partial<Omit<Category, "docId">>) =>
    updateDoc(doc(db, "productCategories", docId), {
      ...data,
      updatedAt: new Date(),
    } as DocumentData),

  deleteCategory: (docId: string) =>
    deleteDoc(doc(db, "productCategories", docId)),

  addModifierToGroup: (groupDocId: string, modifierDocId: string) =>
    updateDoc(doc(db, "modifierGroups", groupDocId), {
      modifierIds: arrayUnion(modifierDocId),
    }),

  removeModifierFromGroup: (groupDocId: string, modifierDocId: string) =>
    updateDoc(doc(db, "modifierGroups", groupDocId), {
      modifierIds: arrayRemove(modifierDocId),
    }),
};

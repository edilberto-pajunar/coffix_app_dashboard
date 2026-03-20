import { db } from "@/app/lib/firebase";
import {
  addDoc,
  arrayRemove,
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  DocumentData,
  onSnapshot,
  QuerySnapshot,
  setDoc,
  Unsubscribe,
  updateDoc,
} from "firebase/firestore";
import { Product } from "../interface/product";
import { Modifier } from "../interface/modifier";
import { ModifierGroup } from "../interface/modifierGroup";
import { Category } from "../interface/category";
import { formatDocId } from "@/app/utils/formatting";

function snapToArray<T>(
  snapshot: QuerySnapshot<DocumentData, DocumentData>,
): T[] {
  return snapshot.docs.map((d) => ({ ...d.data(), docId: d.id })) as T[];
}

export const ProductService = {
  listenToProducts: (onUpdate: (products: Product[]) => void): Unsubscribe =>
    onSnapshot(collection(db, "products"), (snap) =>
      onUpdate(snapToArray<Product>(snap)),
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

  createProduct: async (data: Omit<Product, "docId">) => {
    const ref = doc(collection(db, "products")); // ✅ auto გენ ID

    await setDoc(ref, {
      ...data,
      docId: ref.id, // optional: store the ID inside the document
    });

    return ref;
  },

  updateProduct: (docId: string, data: Partial<Omit<Product, "docId">>) =>
    updateDoc(doc(db, "products", docId), data as DocumentData),

  deleteProduct: (docId: string) => deleteDoc(doc(db, "products", docId)),

  createModifier: async (data: Omit<Modifier, "docId">) => {
    const docId = formatDocId(data.label ?? "");
    const ref = doc(db, "modifiers", docId);
    await setDoc(ref, data);
    return ref;
  },

  updateModifier: (docId: string, data: Partial<Omit<Modifier, "docId">>) =>
    updateDoc(doc(db, "modifiers", docId), data as DocumentData),

  deleteModifier: (docId: string) => deleteDoc(doc(db, "modifiers", docId)),

  createModifierGroup: async (data: Omit<ModifierGroup, "docId">) => {
    const docId = formatDocId(data.name ?? "");
    const ref = doc(db, "modifierGroups", docId);
    await setDoc(ref, data);
    return ref;
  },

  updateModifierGroup: (
    docId: string,
    data: Partial<Omit<ModifierGroup, "docId">>,
  ) => updateDoc(doc(db, "modifierGroups", docId), data as DocumentData),

  deleteModifierGroup: (docId: string) =>
    deleteDoc(doc(db, "modifierGroups", docId)),

  createCategory: async (data: Omit<Category, "docId">) => {
    const docId = formatDocId(data.name ?? "");
    const ref = doc(db, "productCategories", docId);
    await setDoc(ref, data);
    return ref;
  },

  updateCategory: (docId: string, data: Partial<Omit<Category, "docId">>) =>
    updateDoc(doc(db, "productCategories", docId), data as DocumentData),

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

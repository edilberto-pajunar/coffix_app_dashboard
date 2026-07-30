import { db } from "@/app/lib/firebase";
import {
  collection,
  deleteDoc,
  doc,
  DocumentData,
  onSnapshot,
  orderBy,
  query,
  Unsubscribe,
  updateDoc,
  where,
} from "firebase/firestore";
import { Store } from "../interface/store";
import { createWithSequentialId } from "@/app/utils/generateId";
import { ID_PREFIXES } from "@/app/utils/constant";

export const StoreService = {
  listenToStores: (onUpdate: (stores: Store[]) => void): Unsubscribe =>
    onSnapshot(collection(db, "stores"), (snap) => {
      const stores = snap.docs.map((d) => ({
        ...d.data(),
        docId: d.id,
      })) as Store[];
      onUpdate(stores.filter((s) => !s.isDeleted));
    }),

  // The document ID is a sequential, human-readable code (STR-000001) rather than a
  // random Firestore ID, allocated atomically via a counter document.
  createStore: async (data: Omit<Store, "docId">) => {
    const key = "stores";
    const docId = await createWithSequentialId(
      key,
      { ...data, createdAt: new Date() } as Record<string, unknown>,
      { counterKey: key, prefix: ID_PREFIXES.stores },
    );

    return doc(db, key, docId);
  },

  updateStore: (docId: string, data: Partial<Omit<Store, "docId">>) =>
    updateDoc(doc(db, "stores", docId), {
      ...data,
      updatedAt: new Date(),
    } as DocumentData),

  deleteStore: (docId: string) =>
    updateDoc(doc(db, "stores", docId), {
      isDeleted: true,
      deletedAt: new Date(),
    } as DocumentData),
};

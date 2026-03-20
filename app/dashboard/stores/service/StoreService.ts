import { db } from "@/app/lib/firebase";
import {
  addDoc,
  collection,
  doc,
  DocumentData,
  onSnapshot,
  setDoc,
  Unsubscribe,
  updateDoc,
} from "firebase/firestore";
import { Store } from "../interface/store";

export const StoreService = {
  listenToStores: (onUpdate: (stores: Store[]) => void): Unsubscribe =>
    onSnapshot(collection(db, "stores"), (snap) => {
      const stores = snap.docs.map((d) => ({
        ...d.data(),
        docId: d.id,
      })) as Store[];
      onUpdate(stores);
    }),

  createStore: async (data: Omit<Store, "docId">) => {
    const ref = doc(collection(db, "stores")); // ✅ auto გენ ID
    await setDoc(ref, {
      ...data,
      docId: ref.id, // optional: store the ID inside the document
    });
    return ref;
  },

  updateStore: (docId: string, data: Partial<Omit<Store, "docId">>) =>
    updateDoc(doc(db, "stores", docId), data as DocumentData),
};

import { db } from "@/app/lib/firebase";
import {
  addDoc,
  collection,
  doc,
  DocumentData,
  onSnapshot,
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

  createStore: (data: Omit<Store, "docId">) =>
    addDoc(collection(db, "stores"), data),

  updateStore: (docId: string, data: Partial<Omit<Store, "docId">>) =>
    updateDoc(doc(db, "stores", docId), data as DocumentData),
};

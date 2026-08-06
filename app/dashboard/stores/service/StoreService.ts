import { db } from "@/app/lib/firebase";
import {
  arrayRemove,
  collection,
  doc,
  DocumentData,
  onSnapshot,
  Unsubscribe,
  updateDoc,
  writeBatch,
} from "firebase/firestore";
import { Store } from "../interface/store";
import { createWithSequentialId } from "@/app/utils/generateId";
import { ID_PREFIXES } from "@/app/utils/constant";

export const StoreService = {
  /**
   * `stores` excludes soft-deleted records, which is what the UI wants. `allStores`
   * keeps them, so callers can tell "deleted" apart from "never existed" — the CSV
   * importers need that distinction to strip stale IDs without rejecting the row.
   */
  listenToStores: (
    onUpdate: (stores: Store[], allStores: Store[]) => void,
  ): Unsubscribe =>
    onSnapshot(collection(db, "stores"), (snap) => {
      const stores = snap.docs.map((d) => ({
        ...d.data(),
        docId: d.id,
      })) as Store[];
      onUpdate(
        stores.filter((s) => !s.isDeleted),
        stores,
      );
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

  // Soft-deletes a store and detaches it from every product that references it, in one
  // atomic batch. Unlike a product or modifier — whose documents are retained so historical
  // transactions can still resolve names — a store ID left on a product has no such value:
  // it would be exported as a live reference and counted by the "all stores disabled"
  // check. See ProductService.deleteModifierGroupCascade for the same arrangement.
  //
  // A batch caps at 500 writes, so this supports ~499 affected products. Well beyond any
  // realistic catalogue size; chunk the product updates if that ever stops being true.
  deleteStoreCascade: async (docId: string, affectedProductIds: string[]) => {
    const batch = writeBatch(db);
    const deletedAt = new Date();
    affectedProductIds.forEach((pid) =>
      batch.update(doc(db, "products", pid), {
        availableToStores: arrayRemove(docId),
        disabledStores: arrayRemove(docId),
        updatedAt: deletedAt,
      }),
    );
    batch.update(doc(db, "stores", docId), { isDeleted: true, deletedAt });
    await batch.commit();
  },
};

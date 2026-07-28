import { db } from "@/app/lib/firebase";
import {
  collection,
  doc,
  DocumentData,
  onSnapshot,
  updateDoc,
  deleteDoc,
  Unsubscribe,
} from "firebase/firestore";
import { Coupon } from "../interface/coupon";
import { createWithSequentialId } from "@/app/utils/generateId";
import { ID_PREFIXES } from "@/app/utils/constant";

export const CouponService = {
  listenToCoupons: (onUpdate: (coupons: Coupon[]) => void): Unsubscribe =>
    onSnapshot(collection(db, "coupons"), (snap) => {
      const coupons = snap.docs.map((d) => ({
        ...d.data(),
        docId: d.id,
      })) as Coupon[];
      onUpdate(coupons);
    }),

  // The document ID is a sequential, human-readable code (CPN-000001) rather than a
  // random Firestore ID, allocated atomically via a counter document.
  createCoupon: async (data: Omit<Coupon, "docId">) => {
    const key = "coupons";
    const docId = await createWithSequentialId(
      key,
      { ...data, createdAt: new Date() } as Record<string, unknown>,
      { counterKey: key, prefix: ID_PREFIXES.coupons },
    );

    return doc(db, key, docId);
  },

  updateCoupon: (docId: string, data: Partial<Omit<Coupon, "docId">>) =>
    updateDoc(doc(db, "coupons", docId), {
      ...data,
      updatedAt: new Date(),
    } as DocumentData),

  deleteCoupon: (docId: string) => deleteDoc(doc(db, "coupons", docId)),
};

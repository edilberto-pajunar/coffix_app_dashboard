import { db } from "@/app/lib/firebase";
import {
  collection,
  doc,
  DocumentData,
  onSnapshot,
  setDoc,
  updateDoc,
  deleteDoc,
  Unsubscribe,
} from "firebase/firestore";
import { Coupon } from "../interface/coupon";

export const CouponService = {
  listenToCoupons: (onUpdate: (coupons: Coupon[]) => void): Unsubscribe =>
    onSnapshot(collection(db, "coupons"), (snap) => {
      const coupons = snap.docs.map((d) => ({
        ...d.data(),
        docId: d.id,
      })) as Coupon[];
      onUpdate(coupons);
    }),

  createCoupon: async (data: Omit<Coupon, "docId">) => {
    const ref = doc(collection(db, "coupons"));
    await setDoc(ref, { ...data, docId: ref.id });
    return ref;
  },

  updateCoupon: (docId: string, data: Partial<Omit<Coupon, "docId">>) =>
    updateDoc(doc(db, "coupons", docId), data as DocumentData),

  deleteCoupon: (docId: string) => deleteDoc(doc(db, "coupons", docId)),
};

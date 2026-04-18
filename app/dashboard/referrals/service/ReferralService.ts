import { db } from "@/app/lib/firebase";
import {
  collection,
  doc,
  DocumentData,
  onSnapshot,
  Unsubscribe,
  updateDoc,
} from "firebase/firestore";
import { Referral } from "../interface/referral";

export const ReferralService = {
  listenToReferrals: (onUpdate: (referrals: Referral[]) => void): Unsubscribe =>
    onSnapshot(collection(db, "referrals"), (snap) => {
      const referrals = snap.docs.map((d) => ({
        ...d.data(),
        docId: d.id,
      })) as Referral[];
      onUpdate(referrals);
    }),

  updateReferral: (docId: string, data: Partial<Omit<Referral, "docId">>) =>
    updateDoc(doc(db, "referrals", docId), data as DocumentData),
};

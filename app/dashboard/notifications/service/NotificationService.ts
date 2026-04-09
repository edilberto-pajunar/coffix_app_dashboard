import { db } from "@/app/lib/firebase";
import {
  collection,
  deleteDoc,
  doc,
  DocumentData,
  onSnapshot,
  setDoc,
  Timestamp,
  Unsubscribe,
  updateDoc,
} from "firebase/firestore";
import { NotificationCampaign } from "../interface/notification";

export const NotificationService = {
  listenToCampaigns: (
    onUpdate: (campaigns: NotificationCampaign[]) => void,
  ): Unsubscribe =>
    onSnapshot(collection(db, "campaigns"), (snap) => {
      const campaigns = snap.docs.map((d) => ({
        ...d.data(),
        docId: d.id,
      })) as NotificationCampaign[];
      onUpdate(campaigns);
    }),

  createCampaign: async (
    data: Omit<NotificationCampaign, "docId">,
    createdBy: string,
  ) => {
    const ref = doc(collection(db, "campaigns"));
    await setDoc(ref, {
      ...data,
      docId: ref.id,
      createdBy,
      createdAt: Timestamp.now(),
    });
    return ref;
  },

  updateCampaign: (
    docId: string,
    data: Partial<
      Omit<NotificationCampaign, "docId" | "createdAt" | "createdBy">
    >,
  ) => updateDoc(doc(db, "campaigns", docId), data as DocumentData),

  deleteCampaign: (docId: string) => deleteDoc(doc(db, "campaigns", docId)),
};

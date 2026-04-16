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
import { EmailTemplate } from "../interface/emailTemplate";
import { formatDocId } from "@/app/utils/formatting";

export const EmailTemplateService = {
  listenToTemplates: (onUpdate: (templates: EmailTemplate[]) => void): Unsubscribe =>
    onSnapshot(collection(db, "emails"), (snap) => {
      const templates = snap.docs.map((d) => ({
        ...d.data(),
        docId: d.id,
      })) as EmailTemplate[];
      onUpdate(templates);
    }),

  createTemplate: async (
    data: Omit<EmailTemplate, "docId" | "updatedAt">,
    updatedBy: string
  ) => {
    const docId = formatDocId(data.name);
    await setDoc(doc(db, "emails", docId), {
      ...data,
      docId,
      updatedBy,
      updatedAt: Timestamp.now(),
    });
  },

  updateTemplate: (
    docId: string,
    data: Partial<Omit<EmailTemplate, "docId">>,
    updatedBy: string
  ) =>
    updateDoc(doc(db, "emails", docId), {
      ...(data as DocumentData),
      updatedBy,
      updatedAt: Timestamp.now(),
    }),

  deleteTemplate: (docId: string) => deleteDoc(doc(db, "emails", docId)),
};

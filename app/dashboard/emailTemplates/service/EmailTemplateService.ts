import { db } from "@/app/lib/firebase";
import {
  collection,
  deleteDoc,
  doc,
  DocumentData,
  onSnapshot,
  Timestamp,
  Unsubscribe,
  updateDoc,
} from "firebase/firestore";
import { EmailTemplate } from "../interface/emailTemplate";
import { createWithSequentialId } from "@/app/utils/generateId";
import { ID_PREFIXES } from "@/app/utils/constant";

export const EmailTemplateService = {
  listenToTemplates: (onUpdate: (templates: EmailTemplate[]) => void): Unsubscribe =>
    onSnapshot(collection(db, "emails"), (snap) => {
      const templates = snap.docs.map((d) => ({
        ...d.data(),
        docId: d.id,
      })) as EmailTemplate[];
      onUpdate(templates);
    }),

  // The document ID is a sequential, human-readable code (TPL-000001) rather than a
  // slug derived from the template name, allocated atomically via a counter document.
  createTemplate: async (
    data: Omit<EmailTemplate, "docId" | "updatedAt">,
    updatedBy: string
  ) => {
    const key = "emails";
    const docId = await createWithSequentialId(
      key,
      {
        ...data,
        updatedBy,
        createdAt: new Date(),
        updatedAt: Timestamp.now(),
      } as Record<string, unknown>,
      { counterKey: key, prefix: ID_PREFIXES.emails },
    );

    return doc(db, key, docId);
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

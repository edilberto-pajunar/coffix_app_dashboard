import { db } from "@/app/lib/firebase";
import {
  collection,
  doc,
  DocumentData,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  Unsubscribe,
} from "firebase/firestore";
import { GLOBAL_COLLECTION_LOG_ID } from "@/app/utils/constant";
import { Log } from "../interface/log";
import { LogSettings } from "../interface/logSettings";

const logSettingsRef = () => doc(db, "global", GLOBAL_COLLECTION_LOG_ID);

export interface CreateLogInput {
  category: string;
  severityLevel: number;
  /** The verb performed, e.g. "Create Product". */
  action: string;
  /** English description with a reference, e.g. "Admin added Burger product". */
  notes: string;
  page?: string | "";
  /** Staff member who performed the action. */
  userId?: string;
  /** End customer the action was performed on, when applicable. */
  customerId?: string;
}

export const LogService = {
  /**
   * Writes a log through the backend API. Throws on failure — prefer the
   * `useActivityLog()` hook, which supplies the token and swallows errors so a
   * logging outage never breaks the action being logged.
   */
  createLog: async (input: CreateLogInput): Promise<void> => {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_BACKEND_URL}/log/create`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          category: input.category,
          severityLevel: input.severityLevel,
          action: input.action,
          notes: input.notes,
          page: input.page ?? "",
          userId: input.userId ?? "",
          customerId: input.customerId ?? "",
        }),
      },
    );

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error ?? err?.message ?? "Failed to create log");
    }
  },

  listenToLogs: (onUpdate: (items: Log[]) => void): Unsubscribe =>
    onSnapshot(query(collection(db, "logs"), orderBy("time", "desc")), (snap) =>
      onUpdate(snap.docs.map((d) => ({ ...d.data(), docId: d.id }) as Log)),
    ),

  listenToLogSettings: (
    onUpdate: (settings: LogSettings | null) => void,
  ): Unsubscribe =>
    onSnapshot(logSettingsRef(), (snap) => {
      if (snap.exists()) {
        onUpdate({ ...snap.data(), docId: snap.id } as LogSettings);
      } else {
        onUpdate(null);
      }
    }),

  updateLogSettings: (data: Partial<LogSettings>) =>
    setDoc(
      logSettingsRef(),
      { ...data, updatedAt: new Date() } as DocumentData,
      { merge: true },
    ),
};

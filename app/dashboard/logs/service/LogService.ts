import { db } from "@/app/lib/firebase";
import { collection, onSnapshot, orderBy, query, Unsubscribe } from "firebase/firestore";
import { Log } from "../interface/log";

export const LogService = {
  listenToLogs: (onUpdate: (items: Log[]) => void): Unsubscribe =>
    onSnapshot(
      query(collection(db, "logs"), orderBy("time", "desc")),
      (snap) => onUpdate(snap.docs.map((d) => ({ ...d.data(), docId: d.id }) as Log))
    ),
};

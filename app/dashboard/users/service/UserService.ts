import { db } from "@/app/lib/firebase";
import {
  collection,
  doc,
  DocumentData,
  onSnapshot,
  Unsubscribe,
  updateDoc,
} from "firebase/firestore";
import { AppUser } from "../interface/user";

export const UserService = {
  listenToUsers: (onUpdate: (users: AppUser[]) => void): Unsubscribe =>
    onSnapshot(collection(db, "customers"), (snap) => {
      const users = snap.docs.map((d) => ({
        ...d.data(),
        docId: d.id,
      })) as AppUser[];
      onUpdate(users);
    }),

  updateUser: (docId: string, data: Partial<Omit<AppUser, "docId">>) =>
    updateDoc(doc(db, "customers", docId), data as DocumentData),
};

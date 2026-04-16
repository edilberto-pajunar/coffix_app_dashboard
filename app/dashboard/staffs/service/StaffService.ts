import { auth, db } from "@/app/lib/firebase";
import {
  collection,
  deleteDoc,
  doc,
  DocumentData,
  onSnapshot,
  Unsubscribe,
  updateDoc,
} from "firebase/firestore";
import { sendPasswordResetEmail } from "firebase/auth";
import { Staff } from "../interface/staff";

export const StaffService = {
  listenToStaffs: (onUpdate: (staffs: Staff[]) => void): Unsubscribe =>
    onSnapshot(collection(db, "staffs"), (snap) => {
      const staffs = snap.docs.map((d) => ({
        ...d.data(),
        docId: d.id,
      })) as Staff[];
      onUpdate(staffs);
    }),

  /**
   * Creates a Firebase Auth user + Firestore staff doc via the server API route,
   * then sends a password reset email so the new staff can set their own password.
   */
  createStaff: async (data: Omit<Staff, "docId" | "createdAt">) => {
    const res = await fetch("/api/staffs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (!res.ok) {
      const { error } = await res.json();
      throw new Error(error ?? "Failed to create staff");
    }

    // Send the password reset email so the new staff member can set their password
    await sendPasswordResetEmail(auth, data.email);
  },

  updateStaff: (docId: string, data: Partial<Omit<Staff, "docId" | "createdAt">>) =>
    updateDoc(doc(db, "staffs", docId), data as DocumentData),

  deleteStaff: (docId: string) => deleteDoc(doc(db, "staffs", docId)),
};

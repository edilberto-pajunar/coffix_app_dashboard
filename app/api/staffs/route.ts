import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/app/lib/firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";

export async function POST(req: NextRequest) {
  try {
    const { email, role, storeIds } = await req.json();

    if (!email || !role) {
      return NextResponse.json(
        { error: "email and role are required" },
        { status: 400 },
      );
    }

    // 1. Create the Firebase Auth user
    const userRecord = await adminAuth.createUser({ email });

    // 2. Send password reset email so the new staff can set their own password
    await adminAuth.generatePasswordResetLink(email);
    // generatePasswordResetLink creates the link but does not send the email.
    // Sending is handled on the client side (StaffService calls
    // sendPasswordResetEmail after this route returns 201).

    // 3. Write the Firestore staff doc using the Auth UID as the document ID
    const docRef = adminDb.collection("staffs").doc(userRecord.uid);
    await docRef.set({
      docId: userRecord.uid,
      email,
      role,
      storeIds: storeIds ?? [],
      disabled: false,
      createdAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({ uid: userRecord.uid }, { status: 201 });
  } catch (err: unknown) {
    console.error("[POST /api/staffs]", err);
    const message =
      err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

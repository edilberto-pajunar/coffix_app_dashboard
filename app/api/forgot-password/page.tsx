"use client";

import { useState } from "react";
import { sendPasswordResetEmail } from "firebase/auth";
import { toast } from "sonner";
import Link from "next/link";
import { auth } from "@/app/lib/firebase";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await sendPasswordResetEmail(auth, email);
      toast.success("Password reset email sent. Check your inbox.");
      setEmail("");
    } catch {
      toast.error("Could not send reset email. Check the address and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="w-full max-w-sm rounded-xl border border-border bg-white p-8 shadow-sm">
        <h1 className="mb-1 text-xl font-semibold text-primary">Coffix</h1>
        <p className="mb-6 text-sm text-light-grey">
          Enter your email to receive a password reset link.
        </p>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="email" className="text-sm font-medium text-black">
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none ring-primary focus:ring-2 disabled:opacity-50"
              disabled={submitting}
            />
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {submitting ? "Sending…" : "Send reset link"}
          </button>
        </form>
        <p className="mt-4 text-center text-xs text-light-grey">
          <Link href="/login" className="text-primary hover:underline">
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  );
}

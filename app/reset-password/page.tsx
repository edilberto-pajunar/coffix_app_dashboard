"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import Link from "next/link";
import { Eye, EyeOff } from "lucide-react";

type PageState = "verifying" | "invalid" | "form" | "submitting";

const REASON_MESSAGES: Record<string, string> = {
  expired: "This reset link has expired. Please request a new one.",
  used: "This reset link has already been used. Please request a new one.",
  not_found: "This reset link is invalid. Please request a new one.",
};

export default function ResetPasswordPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [state, setState] = useState<PageState>(token ? "verifying" : "invalid");
  const [invalidReason, setInvalidReason] = useState(
    token ? "" : "This reset link is invalid. Please request a new one."
  );
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fieldError, setFieldError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  useEffect(() => {
    if (!token) return;

    fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/auth/verify-reset-token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    })
      .then((res) => res.json())
      .then((data) => {
        console.log(data)
        if (data.data.valid) {
          setState("form");
        } else {
          setInvalidReason(
            REASON_MESSAGES[data.reason] ?? "This reset link is invalid."
          );
          setState("invalid");
        }
      })
      .catch(() => {
        setInvalidReason("Unable to verify the reset link. Please try again.");
        setState("invalid");
      });
  }, [token]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFieldError("");

    if (password.length < 7) {
      setFieldError("Password must be more than 6 characters.");
      return;
    }
    if (!/[A-Z]/.test(password)) {
      setFieldError("Password must contain at least one uppercase letter.");
      return;
    }
    if (!/[0-9]/.test(password)) {
      setFieldError("Password must contain at least one digit.");
      return;
    }
    if (!/[^A-Za-z0-9]/.test(password)) {
      setFieldError("Password must contain at least one symbol.");
      return;
    }
    if (password !== confirmPassword) {
      setFieldError("Passwords do not match.");
      return;
    }

    setState("submitting");
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/auth/reset-password`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token, password }),
        }
      );

      if (res.ok) {
        toast.success("Password updated successfully.");
        router.push("/login");
      } else if (res.status === 400 || res.status === 422) {
        const data = await res.json().catch(() => ({}));
        setFieldError(
          data.message ?? "This link is invalid or expired. Please request a new one."
        );
        setState("form");
      } else {
        toast.error("Something went wrong. Please try again.");
        setState("form");
      }
    } catch {
      toast.error("Something went wrong. Please try again.");
      setState("form");
    }
  }

  console.log(state)

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="w-full max-w-sm rounded-xl border border-border bg-white p-8 shadow-sm">
        <h1 className="mb-1 text-xl font-semibold text-primary">Coffix</h1>

        {state === "verifying" && (
          <p className="mt-4 text-sm text-light-grey">Verifying your link…</p>
        )}

        {state === "invalid" && (
          <>
            <p className="mb-6 text-sm text-light-grey">{invalidReason}</p>
            <Link
              href="/api/forgot-password"
              className="block rounded-lg bg-primary px-4 py-2 text-center text-sm font-medium text-white transition-opacity hover:opacity-90"
            >
              Request a new link
            </Link>
          </>
        )}

        {(state === "form" || state === "submitting") && (
          <>
            <p className="mb-6 text-sm text-light-grey">
              Enter your new password below.
            </p>
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="password"
                  className="text-sm font-medium text-black"
                >
                  New password
                </label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 pr-10 text-sm outline-none ring-primary focus:ring-2 disabled:opacity-50"
                    disabled={state === "submitting"}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute inset-y-0 right-3 flex items-center text-light-grey hover:text-black"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="confirmPassword"
                  className="text-sm font-medium text-black"
                >
                  Confirm password
                </label>
                <div className="relative">
                  <input
                    id="confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    autoComplete="new-password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 pr-10 text-sm outline-none ring-primary focus:ring-2 disabled:opacity-50"
                    disabled={state === "submitting"}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword((v) => !v)}
                    className="absolute inset-y-0 right-3 flex items-center text-light-grey hover:text-black"
                    tabIndex={-1}
                  >
                    {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
              {fieldError && (
                <p className="text-xs text-[var(--error)]">{fieldError}</p>
              )}
              <button
                type="submit"
                disabled={state === "submitting"}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {state === "submitting" ? "Updating…" : "Update password"}
              </button>
            </form>
          </>
        )}

        <p className="mt-4 text-center text-xs text-light-grey">
          <Link href="/login" className="text-primary hover:underline">
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  );
}

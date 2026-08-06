"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useUserStore } from "@/app/dashboard/users/store/useUserStore";

interface AddTransactionDialogProps {
  open: boolean;
  onClose: () => void;
}

const TRANSACTION_TYPES = [
  { value: "refund", label: "Refund" },
  { value: "gift", label: "Gift" },
  { value: "order", label: "Order" },
] as const;

const PAYMENT_METHODS = [
  { value: "coffixCredit", label: "Coffix Credit" },
  { value: "cash", label: "Cash" },
] as const;

const EMPTY_FORM = {
  email: "",
  transactionType: "",
  paymentMethod: "",
  amount: "",
  notes: "",
};

export function AddTransactionDialog({ open, onClose }: AddTransactionDialogProps) {
  const users = useUserStore((s) => s.users);
  const [form, setForm] = useState(EMPTY_FORM);
  const [emailError, setEmailError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(EMPTY_FORM);
      setEmailError("");
    }
  }, [open]);

  function setField<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function findUserIdByEmail(email: string): string | undefined {
    const target = email.trim().toLowerCase();
    return users.find((u) => u.email?.trim().toLowerCase() === target)?.docId;
  }

  const matchedUser = users.find(
    (u) => u.email?.trim().toLowerCase() === form.email.trim().toLowerCase()
  );
  const isCoffixDeduction =
    form.transactionType === "order" && form.paymentMethod === "coffixCredit";
  const amountNum = parseFloat(form.amount);
  const currentCredit = matchedUser?.creditAvailable ?? 0;
  const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim());
  const resultingCredit =
    isCoffixDeduction && isValidEmail && matchedUser && !isNaN(amountNum)
      ? currentCredit - amountNum
      : null;
  const willGoNegative = resultingCredit !== null && resultingCredit < 0;

  async function handleCreate() {
    setEmailError("");

    const email = form.email.trim();
    if (!email) {
      toast.error("Email is required.");
      return;
    }

    const userId = findUserIdByEmail(email);
    if (!userId) {
      setEmailError("No user found with that email.");
      toast.error("No user found with that email.");
      return;
    }

    if (!form.transactionType) {
      toast.error("Transaction type is required.");
      return;
    }
    if (!form.paymentMethod) {
      toast.error("Payment method is required.");
      return;
    }

    const amount = parseFloat(form.amount);
    if (isNaN(amount) || amount <= 0) {
      toast.error("Amount must be a positive number.");
      return;
    }

    setLoading(true);
    try {
      const payload: {
        userId: string;
        transactionType: string;
        paymentMethod: string;
        amount: number;
        notes?: string;
      } = {
        userId,
        transactionType: form.transactionType,
        paymentMethod: form.paymentMethod,
        amount,
      };
      if (form.notes.trim()) payload.notes = form.notes.trim();

      const res = await fetch(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/transaction/create`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.message ?? `Error ${res.status}`);
      }
      toast.success("Transaction created.");
      setForm(EMPTY_FORM);
      onClose();
    } catch (err) {
      console.error(err);
      toast.error("Failed to create transaction.", {
        description: err instanceof Error ? err.message : "Something went wrong.",
      });
    } finally {
      setLoading(false);
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-2xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-border px-6 py-4">
          <h3 className="text-lg font-semibold text-black">New Transaction</h3>
        </div>

        <div className="max-h-[72vh] space-y-4 overflow-y-auto px-6 py-4">
          <div>
            <label className="mb-1.5 block text-xs text-light-grey">
              Customer Email <span className="text-red-500">*</span>
            </label>
            <input
              type="email"
              placeholder="customer@example.com"
              className="w-full rounded-lg border border-border px-3 py-2 text-sm text-black outline-none placeholder:text-grey-500 focus:border-primary"
              value={form.email}
              onChange={(e) => {
                setField("email", e.target.value);
                if (emailError) setEmailError("");
              }}
            />
            {emailError && (
              <p className="mt-1 text-xs text-red-500">{emailError}</p>
            )}
          </div>

          <div>
            <label className="mb-1.5 block text-xs text-light-grey">
              Transaction Type <span className="text-red-500">*</span>
            </label>
            <div className="flex flex-wrap gap-2">
              {TRANSACTION_TYPES.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() =>
                    setForm((f) => ({
                      ...f,
                      transactionType: t.value,
                      paymentMethod:
                        t.value === "gift" && f.paymentMethod === "cash"
                          ? ""
                          : f.paymentMethod,
                    }))
                  }
                  className={`cursor-pointer rounded-lg border px-3 py-2 text-sm transition-colors ${
                    form.transactionType === t.value
                      ? "border-primary bg-primary text-white"
                      : "border-border text-black hover:border-primary"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs text-light-grey">
              Payment Method <span className="text-red-500">*</span>
            </label>
            <div className="flex flex-wrap gap-2">
              {PAYMENT_METHODS.map((m) => {
                const isCashDisabled =
                  m.value === "cash" && form.transactionType === "gift";
                return (
                  <button
                    key={m.value}
                    type="button"
                    disabled={isCashDisabled}
                    onClick={() => setField("paymentMethod", m.value)}
                    className={`rounded-lg border px-3 py-2 text-sm transition-colors ${
                      isCashDisabled
                        ? "cursor-not-allowed border-border text-black opacity-50"
                        : form.paymentMethod === m.value
                          ? "cursor-pointer border-primary bg-primary text-white"
                          : "cursor-pointer border-border text-black hover:border-primary"
                    }`}
                  >
                    {m.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs text-light-grey">
              Amount ($) <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              min="0.01"
              step="0.01"
              placeholder="0.00"
              className="w-full rounded-lg border border-border px-3 py-2 text-sm text-black outline-none placeholder:text-grey-500 focus:border-primary"
              value={form.amount}
              onChange={(e) => setField("amount", e.target.value)}
            />
            {willGoNegative && (
              <p className="mt-1 text-xs text-amber-600">
                Warning: this will make the customer&apos;s Coffix Credit balance
                negative (current: ${currentCredit.toFixed(2)}, after: $
                {resultingCredit!.toFixed(2)}).
              </p>
            )}
          </div>

          <div>
            <label className="mb-1.5 block text-xs text-light-grey">Notes</label>
            <textarea
              rows={3}
              placeholder="Optional note for this transaction"
              className="w-full rounded-lg border border-border px-3 py-2 text-sm text-black outline-none placeholder:text-grey-500 focus:border-primary"
              value={form.notes}
              onChange={(e) => setField("notes", e.target.value)}
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-border px-6 py-4">
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={loading}>
            {loading ? "Creating…" : "Create Transaction"}
          </Button>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { endOfDayNZ } from "@/app/utils/formatting";

interface Store {
  docId?: string;
  name?: string;
}

interface AddCouponDialogProps {
  open: boolean;
  onClose: () => void;
  stores: Store[];
  userIds?: string[];
  defaultEmails?: string[];
}

const EMPTY_FORM = { type: "", amount: "", expiryDate: "", storeId: "", notes: "" };

export function AddCouponDialog({ open, onClose, stores, defaultEmails }: AddCouponDialogProps) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [customerEmails, setCustomerEmails] = useState<string[]>([]);
  const [emailInput, setEmailInput] = useState("");
  const [loading, setLoading] = useState(false);
  const emailInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setForm(EMPTY_FORM);
      setCustomerEmails(defaultEmails ?? []);
      setEmailInput("");
    }
  }, [open, defaultEmails]);

  function setField<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function addEmail() {
    const email = emailInput.trim();
    if (!email) return;
    if (!customerEmails.includes(email)) {
      setCustomerEmails((prev) => [...prev, email]);
    }
    setEmailInput("");
    emailInputRef.current?.focus();
  }

  function removeEmail(email: string) {
    setCustomerEmails((prev) => prev.filter((e) => e !== email));
  }

  function handleEmailKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      addEmail();
    }
  }

  async function handleCreate() {
    if (!form.type.trim()) {
      toast.error("Type is required.");
      return;
    }
    const amt = parseFloat(form.amount);
    if (isNaN(amt) || amt < 0) {
      toast.error("Amount is required.");
      return;
    }
    if (customerEmails.length === 0) {
      toast.error("At least one customer email is required.");
      return;
    }
    if (!form.expiryDate) {
      toast.error("Expiry date is required.");
      return;
    }
    setLoading(true);
    try {
      const payload: {
        type?: string;
        amount?: number;
        expiryDate: string;
        storeId?: string;
        notes?: string;
        customerEmail?: string[];
      } = {
        type: form.type.trim(),
        amount: amt,
        // Always 11:59 PM NZ time of the selected date, matching the dashboard's display timezone.
        expiryDate: endOfDayNZ(form.expiryDate).toISOString(),
        customerEmail: customerEmails,
      };
      if (form.storeId) payload.storeId = form.storeId;
      if (form.notes.trim()) payload.notes = form.notes.trim();

      const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/coupon`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.message ?? `Error ${res.status}`);
      }
      toast.success("Coupon created.");
      onClose();
    } catch (err) {
      toast.error("Failed to create coupon.", {
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
          <h3 className="text-lg font-semibold text-black">New Coupon</h3>
        </div>

        <div className="max-h-[72vh] space-y-4 overflow-y-auto px-6 py-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-xs text-light-grey">
                Type <span className="text-red-500">*</span>
              </label>
              <select
                className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-black outline-none focus:border-primary"
                value={form.type}
                onChange={(e) => setField("type", e.target.value)}
              >
                <option value="">— None —</option>
                <option value="referral">Referral</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-xs text-light-grey">
                Amount ($) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                className="w-full rounded-lg border border-border px-3 py-2 text-sm text-black outline-none placeholder:text-light-grey focus:border-primary"
                value={form.amount}
                onChange={(e) => setField("amount", e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs text-light-grey">
                Expiry Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                className="w-full rounded-lg border border-border px-3 py-2 text-sm text-black outline-none focus:border-primary"
                value={form.expiryDate}
                onChange={(e) => setField("expiryDate", e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs text-light-grey">Store</label>
              <select
                className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-black outline-none focus:border-primary"
                value={form.storeId}
                onChange={(e) => setField("storeId", e.target.value)}
              >
                <option value="">— None —</option>
                {stores.map((s) => (
                  <option key={s.docId} value={s.docId ?? ""}>{s.name ?? s.docId}</option>
                ))}
              </select>
            </div>
            <div className="col-span-2">
              {customerEmails.length > 0 && (
                <div className="mb-2 flex flex-wrap gap-1.5">
                  {customerEmails.map((email) => (
                    <span
                      key={email}
                      className="flex items-center gap-1 rounded-md bg-background border border-border px-2 py-0.5 text-xs text-black"
                    >
                      {email}
                      <button
                        type="button"
                        onClick={() => removeEmail(email)}
                        className="ml-0.5 text-light-grey hover:text-black leading-none"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
              <label className="mb-1.5 block text-xs text-light-grey">
                Customer Email <span className="text-red-500">*</span>
              </label>
              <div className="min-h-[42px] flex flex-wrap items-center gap-1.5 rounded-lg border border-border bg-white px-3 py-2 focus-within:border-primary">
                <div className="flex flex-1 items-center gap-1 min-w-[140px]">
                  <input
                    ref={emailInputRef}
                    type="email"
                    placeholder={customerEmails.length === 0 ? "customer@example.com" : ""}
                    className="flex-1 text-sm text-black outline-none bg-transparent"
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    onKeyDown={handleEmailKeyDown}
                  />
                  <button
                    type="button"
                    onClick={addEmail}
                    className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-primary text-white text-xs font-bold hover:opacity-90"
                  >
                    +
                  </button>
                </div>
              </div>
            </div>
            <div className="col-span-2">
              <label className="mb-1.5 block text-xs text-light-grey">Notes</label>
              <textarea
                rows={3}
                className="w-full rounded-lg border border-border px-3 py-2 text-sm text-black outline-none focus:border-primary"
                value={form.notes}
                onChange={(e) => setField("notes", e.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-border px-6 py-4">
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={loading}>
            {loading ? "Creating…" : "Create Coupon"}
          </Button>
        </div>
      </div>
    </div>
  );
}

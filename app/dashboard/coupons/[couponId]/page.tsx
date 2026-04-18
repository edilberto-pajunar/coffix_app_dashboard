"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { useCouponStore } from "../store/useCouponStore";
import { useUserStore } from "@/app/dashboard/users/store/useUserStore";
import { useStoreStore } from "@/app/dashboard/stores/store/useStoreStore";
import { CouponService } from "../service/CouponService";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(value: unknown): string {
  if (!value) return "—";
  if (value instanceof Date) return value.toLocaleDateString();
  if (typeof value === "object" && value !== null && "seconds" in value) {
    return new Date((value as { seconds: number }).seconds * 1000).toLocaleDateString();
  }
  return "—";
}

function formatDateTime(value: unknown): string {
  if (!value) return "—";
  if (value instanceof Date) return value.toLocaleString();
  if (typeof value === "object" && value !== null && "seconds" in value) {
    return new Date((value as { seconds: number }).seconds * 1000).toLocaleString();
  }
  return "—";
}

function firestoreTimestampToDateString(value: unknown): string {
  if (!value) return "";
  if (value instanceof Date) return value.toLocaleDateString("en-CA");
  if (typeof value === "object" && value !== null && "seconds" in value) {
    return new Date((value as { seconds: number }).seconds * 1000).toLocaleDateString("en-CA");
  }
  return "";
}

// ─── Display components ───────────────────────────────────────────────────────

function InfoRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between px-4 py-3">
      <span className="text-xs text-light-grey">{label}</span>
      <span
        className={`text-sm text-black ${mono ? "font-mono" : ""} max-w-xs truncate text-right`}
        title={value}
      >
        {value}
      </span>
    </div>
  );
}

function InfoCard({ title, rows }: { title: string; rows: { label: string; value: string; mono?: boolean }[] }) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-white shadow-(--shadow)">
      <div className="border-b border-border px-4 py-3">
        <h2 className="font-semibold text-black">{title}</h2>
      </div>
      <div className="divide-y divide-border">
        {rows.map(({ label, value, mono }) => (
          <InfoRow key={label} label={label} value={value} mono={mono} />
        ))}
      </div>
    </div>
  );
}

// ─── Edit form type ───────────────────────────────────────────────────────────

type CouponEditForm = {
  code: string;
  type: string;
  amount: string;
  expiryDate: string;
  notes: string;
  usageLimit: string;
  storeId: string;
  isUsed: boolean;
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CouponDetailPage() {
  const { couponId } = useParams<{ couponId: string }>();
  const router = useRouter();
  const coupons = useCouponStore((s) => s.coupons);
  const users = useUserStore((s) => s.users);
  const stores = useStoreStore((s) => s.stores);

  const coupon = coupons.find((c) => c.docId === couponId);

  const [showEdit, setShowEdit] = useState(false);
  const [form, setForm] = useState<CouponEditForm | null>(null);
  const [loading, setLoading] = useState(false);

  if (!coupon) {
    return (
      <div className="flex h-64 items-center justify-center text-light-grey">
        Coupon not found.
      </div>
    );
  }

  const storeName = stores.find((s) => s.docId === coupon.storeId)?.name ?? coupon.storeId ?? "—";

  function openEdit() {
    setForm({
      code: coupon!.code ?? "",
      type: coupon!.type ?? "",
      amount: (coupon!.amount ?? "").toString(),
      expiryDate: firestoreTimestampToDateString(coupon!.expiryDate),
      notes: coupon!.notes ?? "",
      usageLimit: (coupon!.usageLimit ?? "").toString(),
      storeId: coupon!.storeId ?? "",
      isUsed: coupon!.isUsed ?? false,
    });
    setShowEdit(true);
  }

  function closeEdit() {
    setShowEdit(false);
    setForm(null);
  }

  function setField<K extends keyof CouponEditForm>(key: K, value: CouponEditForm[K]) {
    setForm((f) => (f ? { ...f, [key]: value } : f));
  }

  async function handleSave() {
    if (!form || !coupon?.docId) return;
    const expiryDate = form.expiryDate ? new Date(form.expiryDate + "T00:00:00") : undefined;
    const amount = parseFloat(form.amount);
    const usageLimit = parseInt(form.usageLimit);
    setLoading(true);
    try {
      await CouponService.updateCoupon(coupon.docId, {
        code: form.code.trim() || undefined,
        type: form.type.trim() || undefined,
        amount: isNaN(amount) ? undefined : amount,
        expiryDate: expiryDate && !isNaN(expiryDate.getTime()) ? expiryDate : undefined,
        notes: form.notes.trim() || undefined,
        usageLimit: isNaN(usageLimit) ? undefined : usageLimit,
        storeId: form.storeId.trim() || undefined,
        isUsed: form.isUsed,
      });
      toast.success("Coupon updated.");
      closeEdit();
    } catch {
      toast.error("Failed to update coupon.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <button
            onClick={() => router.push("/dashboard/coupons")}
            className="mb-2 text-xs text-light-grey hover:text-black"
          >
            ← Back to Coupons
          </button>
          <div className="flex items-center gap-3">
            <h1 className="font-mono text-2xl font-semibold text-black">{coupon.code ?? "—"}</h1>
            {coupon.isUsed ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-black px-2.5 py-1 text-xs font-medium text-white">
                <span className="h-1.5 w-1.5 rounded-full bg-white" />
                Used
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-green-50 px-2.5 py-1 text-xs font-medium text-success">
                <span className="h-1.5 w-1.5 rounded-full bg-success" />
                Active
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-light-grey">{coupon.type ?? "No type"}</p>
        </div>
        <button
          onClick={openEdit}
          className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-black transition-colors hover:border-primary hover:text-primary"
        >
          Edit
        </button>
      </div>

      {/* Cards */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <InfoCard
          title="Coupon Details"
          rows={[
            { label: "Code", value: coupon.code ?? "—", mono: true },
            { label: "Type", value: coupon.type ?? "—" },
            { label: "Amount", value: `$${(coupon.amount ?? 0).toFixed(2)}` },
            { label: "Expiry Date", value: formatDate(coupon.expiryDate) },
            { label: "Status", value: coupon.isUsed ? "Used" : "Active" },
            { label: "Source", value: coupon.source ?? "—" },
            { label: "Referral ID", value: coupon.referralId ?? "—", mono: true },
          ]}
        />

        <InfoCard
          title="Usage"
          rows={[
            { label: "Usage Count", value: (coupon.usageCount ?? 0).toString() },
            { label: "Usage Limit", value: coupon.usageLimit?.toString() ?? "Unlimited" },
            { label: "Progress", value: `${coupon.usageCount ?? 0} / ${coupon.usageLimit ?? "∞"}` },
          ]}
        />

        <InfoCard
          title="Store"
          rows={[
            { label: "Store ID", value: coupon.storeId ?? "—", mono: true },
            { label: "Store Name", value: storeName },
          ]}
        />

        {/* Customers card — rendered manually for the list */}
        <div className="overflow-hidden rounded-xl border border-border bg-white shadow-(--shadow)">
          <div className="border-b border-border px-4 py-3">
            <h2 className="font-semibold text-black">Customers</h2>
          </div>
          <div className="divide-y divide-border">
            {!coupon.userIds || coupon.userIds.length === 0 ? (
              <p className="px-4 py-3 text-sm text-light-grey">No customers assigned.</p>
            ) : (
              coupon.userIds.map((uid) => {
                const user = users.find((u) => u.docId === uid);
                return (
                  <div key={uid} className="px-4 py-3">
                    <p className="text-sm text-black">{user?.email ?? "—"}</p>
                    <p className="font-mono text-xs text-light-grey">{uid}</p>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="lg:col-span-2">
          <InfoCard
            title="Metadata"
            rows={[
              { label: "Doc ID", value: coupon.docId ?? "—", mono: true },
              { label: "Created At", value: formatDateTime(coupon.createdAt) },
              { label: "Notes", value: coupon.notes ?? "—" },
            ]}
          />
        </div>
      </div>

      {/* Edit modal */}
      {showEdit && form && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={closeEdit}
        >
          <div
            className="w-full max-w-lg rounded-2xl bg-white shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="border-b border-border px-6 py-4">
              <h3 className="text-lg font-semibold text-black">Edit Coupon</h3>
            </div>

            <div className="max-h-[72vh] space-y-4 overflow-y-auto px-6 py-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1.5 block text-xs text-light-grey">Code</label>
                  <input
                    className="w-full rounded-lg border border-border px-3 py-2 font-mono text-sm text-black outline-none focus:border-primary"
                    value={form.code}
                    onChange={(e) => setField("code", e.target.value)}
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs text-light-grey">Type</label>
                  <input
                    className="w-full rounded-lg border border-border px-3 py-2 text-sm text-black outline-none focus:border-primary"
                    value={form.type}
                    onChange={(e) => setField("type", e.target.value)}
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs text-light-grey">Amount ($)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    className="w-full rounded-lg border border-border px-3 py-2 text-sm text-black outline-none focus:border-primary"
                    value={form.amount}
                    onChange={(e) => setField("amount", e.target.value)}
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs text-light-grey">Expiry Date</label>
                  <input
                    type="date"
                    className="w-full rounded-lg border border-border px-3 py-2 text-sm text-black outline-none focus:border-primary"
                    value={form.expiryDate}
                    onChange={(e) => setField("expiryDate", e.target.value)}
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs text-light-grey">Usage Limit</label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    className="w-full rounded-lg border border-border px-3 py-2 text-sm text-black outline-none focus:border-primary"
                    value={form.usageLimit}
                    onChange={(e) => setField("usageLimit", e.target.value)}
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
                      <option key={s.docId} value={s.docId}>
                        {s.name ?? s.docId}
                      </option>
                    ))}
                  </select>
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

              <div>
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-light-grey">Flags</p>
                <div className="divide-y divide-border overflow-hidden rounded-lg border border-border">
                  <label className="flex cursor-pointer items-center justify-between px-3 py-2.5 hover:bg-[#fafafa]">
                    <span className="text-sm text-black">Is Used</span>
                    <input
                      type="checkbox"
                      checked={form.isUsed}
                      onChange={(e) => setField("isUsed", e.target.checked)}
                      className="accent-primary"
                    />
                  </label>
                </div>
              </div>

              <div>
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-light-grey">Read-only</p>
                <div className="space-y-2 rounded-lg border border-border bg-[#fafafa] px-3 py-2">
                  {[
                    { label: "Doc ID", value: coupon.docId ?? "—" },
                    { label: "Usage Count", value: (coupon.usageCount ?? 0).toString() },
                    { label: "Source", value: coupon.source ?? "—" },
                    { label: "Referral ID", value: coupon.referralId ?? "—" },
                  ].map(({ label, value }) => (
                    <div key={label} className="flex items-center justify-between gap-4">
                      <span className="shrink-0 text-xs text-light-grey">{label}</span>
                      <span className="truncate font-mono text-xs text-black" title={value}>{value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-border px-6 py-4">
              <button
                onClick={closeEdit}
                className="rounded-lg border border-border px-4 py-2 text-sm text-black hover:bg-[#f0f0f0]"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={loading}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:opacity-80 disabled:opacity-50"
              >
                {loading ? "Saving…" : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

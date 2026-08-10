"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { useCouponStore } from "../store/useCouponStore";
import { useStoreStore } from "@/app/dashboard/stores/store/useStoreStore";
import { CouponService } from "../service/CouponService";
import { Coupon } from "../interface/coupon";
import { formatDateTime, toNZDateInputValue, endOfDayNZ } from "@/app/utils/formatting";
import { Button } from "@/components/ui/button";

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
  type: string;
  amount: string;
  remainingAmount: string;
  expiryDate: string;
  notes: string;
  storeId: string;
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CouponDetailPage() {
  const { couponId } = useParams<{ couponId: string }>();
  const router = useRouter();
  const coupons = useCouponStore((s) => s.coupons);
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
      type: ["referral", "admin"].includes(coupon!.type ?? "") ? coupon!.type! : "referral",
      amount: (coupon!.amount ?? "").toString(),
      remainingAmount: (coupon!.remainingAmount ?? coupon!.amount ?? 0).toString(),
      expiryDate: toNZDateInputValue(coupon!.expiryDate),
      notes: coupon!.notes ?? "",
      storeId: coupon!.storeId ?? "",
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
    setLoading(true);
    try {
      const data: Partial<Omit<Coupon, "docId">> = {};
      if (form.type.trim()) data.type = form.type.trim();
      const amount = parseFloat(form.amount);
      if (!isNaN(amount) && amount >= 0) data.amount = amount;
      const remainingAmount = parseFloat(form.remainingAmount);
      if (!isNaN(remainingAmount) && remainingAmount >= 0) data.remainingAmount = remainingAmount;
      if (form.expiryDate) {
        const d = endOfDayNZ(form.expiryDate);
        if (!isNaN(d.getTime())) data.expiryDate = d;
      }
      if (form.notes.trim()) data.notes = form.notes.trim();
      if (form.storeId.trim()) data.storeId = form.storeId.trim();
      await CouponService.updateCoupon(coupon.docId, data);
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
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push("/dashboard/coupons")}
            className="mb-2"
          >
            ← Back to Coupons
          </Button>
          <div className="flex items-center gap-3">
          </div>
          <p className="mt-1 text-sm text-light-grey">{coupon.type ?? "No type"}</p>
        </div>
        <Button variant="outline" onClick={openEdit}>
          Edit
        </Button>
      </div>

      {/* Cards */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <InfoCard
          title="Coupon Details"
          rows={[
            { label: "Type", value: coupon.type ?? "—" },
            { label: "Amount", value: `$${(coupon.amount ?? 0).toFixed(2)}` },
            { label: "Remaining", value: `$${(coupon.remainingAmount ?? coupon.amount ?? 0).toFixed(2)}` },
            { label: "Expiry Date", value: formatDateTime(coupon.expiryDate) },
          ]}
        />


        <InfoCard
          title="Store"
          rows={[
            { label: "Store ID", value: coupon.storeId ?? "—", mono: true },
            { label: "Store Name", value: storeName },
          ]}
        />


        <div className="lg:col-span-2">
          <InfoCard
            title="Metadata"
            rows={[
              { label: "Doc ID", value: coupon.docId ?? "—", mono: true },
              { label: "Email", value: coupon.customerEmail ?? "—" },
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
                  <label className="mb-1.5 block text-xs text-light-grey">Type</label>
                  <select
                    className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-black outline-none focus:border-primary"
                    value={form.type}
                    onChange={(e) => setField("type", e.target.value)}
                  >
                    <option value="referral">Referral</option>
                    <option value="admin">Admin</option>
                  </select>
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
                  <label className="mb-1.5 block text-xs text-light-grey">Remaining Amount ($)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    className="w-full rounded-lg border border-border px-3 py-2 text-sm text-black outline-none focus:border-primary"
                    value={form.remainingAmount}
                    onChange={(e) => setField("remainingAmount", e.target.value)}
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

            </div>

            <div className="flex justify-end gap-2 border-t border-border px-6 py-4">
              <Button variant="outline" onClick={closeEdit}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={loading}>
                {loading ? "Saving…" : "Save Changes"}
              </Button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useCouponStore } from "./store/useCouponStore";
import { useUserStore } from "@/app/dashboard/users/store/useUserStore";
import { useStoreStore } from "@/app/dashboard/stores/store/useStoreStore";
import { CouponService } from "./service/CouponService";
import { Coupon } from "./interface/coupon";
import { AppUser } from "@/app/dashboard/users/interface/user";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(value: unknown): string {
  if (!value) return "—";
  if (value instanceof Date) return value.toLocaleDateString();
  if (typeof value === "object" && value !== null && "seconds" in value) {
    return new Date((value as { seconds: number }).seconds * 1000).toLocaleDateString();
  }
  return "—";
}

function firestoreToMs(value: unknown): number {
  if (!value) return 0;
  if (value instanceof Date) return value.getTime();
  if (typeof value === "object" && value !== null && "seconds" in value) {
    return (value as { seconds: number }).seconds * 1000;
  }
  return 0;
}

function resolveUserEmails(userIds: string[] | undefined, users: AppUser[]): string {
  if (!userIds || userIds.length === 0) return "—";
  return userIds.map((id) => users.find((u) => u.docId === id)?.email ?? id).join(", ");
}

function tsToISO(value: unknown): string {
  if (!value) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "object" && value !== null && "seconds" in value) {
    return new Date((value as { seconds: number }).seconds * 1000).toISOString().slice(0, 10);
  }
  return "";
}

function escapeCSV(v: string): string {
  return `"${v.replace(/"/g, '""')}"`;
}

function IndeterminateCheckbox({
  checked,
  indeterminate,
  onChange,
  onClick,
}: {
  checked: boolean;
  indeterminate: boolean;
  onChange: () => void;
  onClick?: (e: React.MouseEvent) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate;
  }, [indeterminate]);
  return (
    <input
      ref={ref}
      type="checkbox"
      checked={checked}
      onChange={onChange}
      onClick={onClick}
      className="h-4 w-4 cursor-pointer accent-primary"
    />
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type CouponSortKey = "amount" | "expiryDate" | "createdAt";
type SortDir = "asc" | "desc";
type BulkDialog = "delete" | "expiry" | "amount" | null;

export default function CouponsPage() {
  const coupons = useCouponStore((s) => s.coupons);
  const users = useUserStore((s) => s.users);
  const stores = useStoreStore((s) => s.stores);
  const router = useRouter();

  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState<"All" | "Used" | "Unused">("All");
  const [sortKey, setSortKey] = useState<CouponSortKey>("createdAt");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDialog, setBulkDialog] = useState<BulkDialog>(null);
  const [bulkExpiry, setBulkExpiry] = useState("");
  const [bulkAmount, setBulkAmount] = useState("");
  const [bulkLoading, setBulkLoading] = useState(false);
  const [importLoading, setImportLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function toggleSort(key: CouponSortKey) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("asc"); }
  }

  const uniqueTypes = useMemo(() => {
    const types = new Set<string>();
    coupons.forEach((c) => { if (c.type) types.add(c.type); });
    return Array.from(types).sort();
  }, [coupons]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let result = coupons.filter((c) => {
      if (typeFilter !== "All" && c.type !== typeFilter) return false;
      if (statusFilter === "Used" && !c.isUsed) return false;
      if (statusFilter === "Unused" && c.isUsed) return false;
      if (q) {
        const code = (c.code ?? "").toLowerCase();
        const notes = (c.notes ?? "").toLowerCase();
        if (!code.includes(q) && !notes.includes(q)) return false;
      }
      return true;
    });
    result = [...result].sort((a, b) => {
      let cmp = 0;
      if (sortKey === "amount") {
        cmp = (a.amount ?? 0) - (b.amount ?? 0);
      } else if (sortKey === "expiryDate") {
        cmp = firestoreToMs(a.expiryDate) - firestoreToMs(b.expiryDate);
      } else {
        cmp = firestoreToMs(a.createdAt) - firestoreToMs(b.createdAt);
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return result;
  }, [coupons, search, typeFilter, statusFilter, sortKey, sortDir]);

  const allSelected = filtered.length > 0 && filtered.every((c) => selectedIds.has(c.docId!));
  const someSelected = !allSelected && filtered.some((c) => selectedIds.has(c.docId!));

  function toggleSelectAll() {
    if (allSelected) setSelectedIds(new Set());
    else setSelectedIds(new Set(filtered.map((c) => c.docId!)));
  }

  function toggleCoupon(docId: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(docId) ? next.delete(docId) : next.add(docId);
      return next;
    });
  }

  // ── Bulk handlers ──

  async function handleBulkDelete() {
    setBulkLoading(true);
    try {
      await Promise.all(Array.from(selectedIds).map((id) => CouponService.deleteCoupon(id)));
      toast.success(`Deleted ${selectedIds.size} coupon(s).`);
      setSelectedIds(new Set());
      setBulkDialog(null);
    } catch {
      toast.error("Failed to delete coupons.");
    } finally {
      setBulkLoading(false);
    }
  }

  async function handleBulkExpiry() {
    if (!bulkExpiry) { toast.error("Select a date."); return; }
    const date = new Date(bulkExpiry + "T00:00:00");
    setBulkLoading(true);
    try {
      await Promise.all(
        Array.from(selectedIds).map((id) =>
          CouponService.updateCoupon(id, { expiryDate: date })
        )
      );
      toast.success(`Updated expiry for ${selectedIds.size} coupon(s).`);
      setSelectedIds(new Set());
      setBulkDialog(null);
      setBulkExpiry("");
    } catch {
      toast.error("Failed to update expiry.");
    } finally {
      setBulkLoading(false);
    }
  }

  async function handleBulkAmount() {
    const amt = parseFloat(bulkAmount);
    if (isNaN(amt) || amt < 0) { toast.error("Enter a valid amount."); return; }
    setBulkLoading(true);
    try {
      await Promise.all(
        Array.from(selectedIds).map((id) =>
          CouponService.updateCoupon(id, { amount: amt })
        )
      );
      toast.success(`Updated amount for ${selectedIds.size} coupon(s).`);
      setSelectedIds(new Set());
      setBulkDialog(null);
      setBulkAmount("");
    } catch {
      toast.error("Failed to update amount.");
    } finally {
      setBulkLoading(false);
    }
  }

  // ── CSV Export ──

  function exportToCSV() {
    const headers = [
      "code", "type", "amount", "expiryDate", "storeId", "notes",
      "usageLimit", "usageCount", "isUsed", "source", "referralId",
      "userIds", "createdAt",
    ];
    const rows = coupons.map((c) => [
      escapeCSV(c.code ?? ""),
      escapeCSV(c.type ?? ""),
      c.amount ?? "",
      tsToISO(c.expiryDate),
      escapeCSV(c.storeId ?? ""),
      escapeCSV(c.notes ?? ""),
      c.usageLimit ?? "",
      c.usageCount ?? "",
      c.isUsed ?? "",
      escapeCSV(c.source ?? ""),
      escapeCSV(c.referralId ?? ""),
      escapeCSV((c.userIds ?? []).join("|")),
      tsToISO(c.createdAt),
    ].join(","));
    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `coupons-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ── CSV Import ──

  async function handleImportCSV(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportLoading(true);
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const text = ev.target?.result as string;
        const lines = text.split("\n").slice(1).filter((l) => l.trim());
        let created = 0;
        for (const line of lines) {
          const cols = line.match(/("(?:[^"]|"")*"|[^,]*)/g)
            ?.map((c) => c.replace(/^"|"$/g, "").replace(/""/g, '"')) ?? [];
          const [
            code, type, amount, expiryDate, storeId, notes,
            usageLimit, usageCount, isUsed, source, referralId,
            userIdsRaw, createdAt,
          ] = cols;
          if (!code) continue;
          const parsedExpiry = expiryDate ? new Date(expiryDate) : undefined;
          const parsedCreated = createdAt ? new Date(createdAt) : undefined;
          const couponData: Omit<Coupon, "docId"> = {
            code,
            type: type || undefined,
            amount: amount ? parseFloat(amount) : undefined,
            expiryDate: parsedExpiry && !isNaN(parsedExpiry.getTime()) ? parsedExpiry : undefined,
            storeId: storeId || undefined,
            notes: notes || undefined,
            usageLimit: usageLimit ? parseInt(usageLimit) : undefined,
            usageCount: usageCount ? parseInt(usageCount) : undefined,
            isUsed: isUsed === "true",
            source: source || undefined,
            referralId: referralId || undefined,
            userIds: userIdsRaw ? userIdsRaw.split("|").filter(Boolean) : [],
            createdAt: parsedCreated && !isNaN(parsedCreated.getTime()) ? parsedCreated : new Date(),
          };
          await CouponService.createCoupon(couponData);
          created++;
        }
        toast.success(`Imported ${created} coupon(s).`);
      } catch {
        toast.error("Failed to import CSV. Check the file format.");
      } finally {
        setImportLoading(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    };
    reader.readAsText(file);
  }

  // ── Render ──

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-black">Coupons</h1>
          <p className="mt-1 text-sm text-light-grey">
            {coupons.length} coupon{coupons.length !== 1 ? "s" : ""} total
          </p>
        </div>
        <div className="flex gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            onChange={handleImportCSV}
            className="hidden"
          />
          {/* <Button
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={importLoading}
          >
            {importLoading ? "Importing…" : "Import CSV"}
          </Button> */}
          <Button size="sm" onClick={exportToCSV}>
            Export CSV
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="text"
          placeholder="Search by code or notes…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-9 w-full rounded-lg border border-border bg-white px-3 text-sm text-black outline-none placeholder:text-light-grey focus:border-primary sm:max-w-xs"
        />
        <div className="flex flex-wrap gap-2">
          {(["All", "Used", "Unused"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setStatusFilter(v)}
              className={`rounded-full border px-3 py-1 text-xs transition-colors ${statusFilter === v ? "border-primary bg-primary text-white" : "border-border text-black hover:bg-soft-grey"}`}
            >
              {v === "All" ? "All Statuses" : v}
            </button>
          ))}
        </div>
        {uniqueTypes.length > 0 && (
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setTypeFilter("All")}
              className={`rounded-full border px-3 py-1 text-xs transition-colors ${typeFilter === "All" ? "border-primary bg-primary text-white" : "border-border text-black hover:bg-soft-grey"}`}
            >
              All Types
            </button>
            {uniqueTypes.map((t) => (
              <button
                key={t}
                onClick={() => setTypeFilter(t)}
                className={`rounded-full border px-3 py-1 text-xs transition-colors ${typeFilter === t ? "border-primary bg-primary text-white" : "border-border text-black hover:bg-soft-grey"}`}
              >
                {t}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Bulk action bar */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 rounded-xl border border-border bg-white px-5 py-3 shadow-(--shadow)">
          <span className="text-sm text-light-grey">{selectedIds.size} selected</span>
          <Button size="sm" variant="destructive" onClick={() => setBulkDialog("delete")}>
            Delete
          </Button>
          <Button size="sm" onClick={() => setBulkDialog("expiry")}>
            Update Expiry
          </Button>
          <Button size="sm" onClick={() => setBulkDialog("amount")}>
            Update Amount
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setSelectedIds(new Set())}>
            Clear
          </Button>
        </div>
      )}

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-border bg-white shadow-(--shadow)">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-background">
              <th className="w-10 px-5 py-3">
                <IndeterminateCheckbox
                  checked={allSelected}
                  indeterminate={someSelected}
                  onChange={toggleSelectAll}
                />
              </th>
              <th className="px-5 py-3 text-left font-medium text-light-grey">Code</th>
              <th className="px-5 py-3 text-left font-medium text-light-grey">Type</th>
              <th
                onClick={() => toggleSort("amount")}
                className="cursor-pointer select-none px-5 py-3 text-right font-medium text-light-grey hover:text-black"
              >
                Amount {sortKey === "amount" ? (sortDir === "asc" ? "↑" : "↓") : <span className="opacity-30">↕</span>}
              </th>
              <th
                onClick={() => toggleSort("expiryDate")}
                className="cursor-pointer select-none px-5 py-3 text-left font-medium text-light-grey hover:text-black"
              >
                Expiry {sortKey === "expiryDate" ? (sortDir === "asc" ? "↑" : "↓") : <span className="opacity-30">↕</span>}
              </th>
              <th className="px-5 py-3 text-left font-medium text-light-grey">Customer(s)</th>
              <th className="px-5 py-3 text-left font-medium text-light-grey">Store</th>
              <th className="px-5 py-3 text-left font-medium text-light-grey">Usage</th>
              <th className="px-5 py-3 text-left font-medium text-light-grey">Status</th>
              <th
                onClick={() => toggleSort("createdAt")}
                className="cursor-pointer select-none px-5 py-3 text-left font-medium text-light-grey hover:text-black"
              >
                Created {sortKey === "createdAt" ? (sortDir === "asc" ? "↑" : "↓") : <span className="opacity-30">↕</span>}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-5 py-10 text-center text-light-grey">
                  No coupons found.
                </td>
              </tr>
            ) : (
              filtered.map((coupon) => {
                const isSelected = selectedIds.has(coupon.docId!);
                const storeName = stores.find((s) => s.docId === coupon.storeId)?.name ?? coupon.storeId ?? "—";
                return (
                  <tr
                    key={coupon.docId}
                    onClick={() => router.push(`/dashboard/coupons/${coupon.docId}`)}
                    className={`cursor-pointer transition-colors hover:bg-background ${isSelected ? "bg-background" : ""}`}
                  >
                    <td
                      className="px-5 py-3"
                      onClick={(e) => { e.stopPropagation(); toggleCoupon(coupon.docId!); }}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleCoupon(coupon.docId!)}
                        onClick={(e) => e.stopPropagation()}
                        className="h-4 w-4 cursor-pointer accent-primary"
                      />
                    </td>
                    <td className="px-5 py-3 font-mono font-medium text-black">{coupon.code ?? "—"}</td>
                    <td className="px-5 py-3 text-black">{coupon.type ?? "—"}</td>
                    <td className="px-5 py-3 text-right text-black">
                      ${(coupon.amount ?? 0).toFixed(2)}
                    </td>
                    <td className="px-5 py-3 text-black">{formatDate(coupon.expiryDate)}</td>
                    <td className="max-w-[180px] truncate px-5 py-3 text-black" title={resolveUserEmails(coupon.userIds, users)}>
                      {resolveUserEmails(coupon.userIds, users)}
                    </td>
                    <td className="px-5 py-3 text-black">{storeName}</td>
                    <td className="px-5 py-3 text-black">
                      {coupon.usageCount ?? 0}/{coupon.usageLimit ?? "∞"}
                    </td>
                    <td className="px-5 py-3">
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
                    </td>
                    <td className="px-5 py-3 text-black">{formatDate(coupon.createdAt)}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Delete Dialog */}
      <Dialog
        open={bulkDialog === "delete"}
        onOpenChange={(open) => { if (!open) setBulkDialog(null); }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Coupons</DialogTitle>
          </DialogHeader>
          <div className="py-2">
            <p className="text-sm text-light-grey">
              Delete <span className="font-medium text-black">{selectedIds.size}</span> selected coupon(s)? This cannot be undone.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkDialog(null)} disabled={bulkLoading}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleBulkDelete} disabled={bulkLoading}>
              {bulkLoading ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Update Expiry Dialog */}
      <Dialog
        open={bulkDialog === "expiry"}
        onOpenChange={(open) => { if (!open) { setBulkDialog(null); setBulkExpiry(""); } }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update Expiry Date</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-light-grey">
              Set new expiry date for <span className="font-medium text-black">{selectedIds.size}</span> coupon(s).
            </p>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-black">Expiry Date</label>
              <input
                type="date"
                value={bulkExpiry}
                onChange={(e) => setBulkExpiry(e.target.value)}
                className="h-9 w-full rounded-lg border border-border bg-white px-3 text-sm text-black outline-none focus:border-primary"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setBulkDialog(null); setBulkExpiry(""); }} disabled={bulkLoading}>
              Cancel
            </Button>
            <Button onClick={handleBulkExpiry} disabled={bulkLoading}>
              {bulkLoading ? "Applying…" : "Apply"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Update Amount Dialog */}
      <Dialog
        open={bulkDialog === "amount"}
        onOpenChange={(open) => { if (!open) { setBulkDialog(null); setBulkAmount(""); } }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update Amount</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-light-grey">
              Set new amount for <span className="font-medium text-black">{selectedIds.size}</span> coupon(s).
            </p>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-black">Amount ($)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={bulkAmount}
                onChange={(e) => setBulkAmount(e.target.value)}
                placeholder="0.00"
                className="h-9 w-full rounded-lg border border-border bg-white px-3 text-sm text-black outline-none placeholder:text-light-grey focus:border-primary"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setBulkDialog(null); setBulkAmount(""); }} disabled={bulkLoading}>
              Cancel
            </Button>
            <Button onClick={handleBulkAmount} disabled={bulkLoading}>
              {bulkLoading ? "Applying…" : "Apply"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}

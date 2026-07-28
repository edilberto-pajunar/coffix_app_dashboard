"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useCouponStore } from "./store/useCouponStore";
import { useStoreStore } from "@/app/dashboard/stores/store/useStoreStore";
import { CouponService } from "./service/CouponService";
import { Coupon } from "./interface/coupon";
import {
  COUPON_PROTECTED_FIELDS,
  COUPON_IMPORTABLE_FIELDS,
} from "./constants/couponFieldConstants";
import {
  escapeCSV,
  tsToISO,
  parseCSVText,
  triggerCSVDownload,
} from "@/app/utils/csvUtils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { CouponsFilterBar } from "./components/CouponsFilterBar";
import { AddCouponDialog } from "./components/AddCouponDialog";
import { formatDateTime } from "@/app/utils/formatting";
import { useActivityLog } from "../logs/hooks/useActivityLog";
import { LOG_CATEGORY, LOG_PAGE, LOG_SEVERITY } from "../logs/constants/logConstants";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function firestoreToMs(value: unknown): number {
  if (!value) return 0;
  if (value instanceof Date) return value.getTime();
  if (typeof value === "object" && value !== null && "seconds" in value) {
    return (value as { seconds: number }).seconds * 1000;
  }
  return 0;
}

// ─── Types ─────────────────────────────────────────────────────────────────────

type CouponSortKey = "amount" | "expiryDate" | "createdAt";
type SortDir = "asc" | "desc";
type BulkDialog = "delete" | "expiry" | "amount" | null;
type ImportError = { row: number; field: string; reason: string };
type ImportPreview = { validRows: Record<string, string>[]; errors: ImportError[] } | null;

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CouponsPage() {
  const coupons = useCouponStore((s) => s.coupons);
  const stores = useStoreStore((s) => s.stores);
  const router = useRouter();

  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("All");
  const [storeFilter, setStoreFilter] = useState("");
  const [emailFilter, setEmailFilter] = useState("");
  const [expiryFrom, setExpiryFrom] = useState("");
  const [expiryTo, setExpiryTo] = useState("");
  const [amountMin, setAmountMin] = useState("");
  const [amountMax, setAmountMax] = useState("");

  const anyFilterActive =
    search.trim() !== "" ||
    typeFilter !== "All" ||
    storeFilter !== "" ||
    emailFilter.trim() !== "" ||
    expiryFrom !== "" ||
    expiryTo !== "" ||
    amountMin !== "" ||
    amountMax !== "";

  function clearAllFilters() {
    setSearch("");
    setTypeFilter("All");
    setStoreFilter("");
    setEmailFilter("");
    setExpiryFrom("");
    setExpiryTo("");
    setAmountMin("");
    setAmountMax("");
  }

  const [sortKey, setSortKey] = useState<CouponSortKey>("createdAt");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDialog, setBulkDialog] = useState<BulkDialog>(null);
  const [bulkExpiry, setBulkExpiry] = useState("");
  const [bulkAmount, setBulkAmount] = useState("");
  const [bulkLoading, setBulkLoading] = useState(false);
  const { log } = useActivityLog();

  const [showCreate, setShowCreate] = useState(false);

  const [importLoading, setImportLoading] = useState(false);
  const [importPreview, setImportPreview] = useState<ImportPreview>(null);
  const [showImportInfo, setShowImportInfo] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function toggleSort(key: CouponSortKey) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("asc"); }
  }

  // const uniqueTypes = useMemo(() => {
  //   const types = new Set<string>();
  //   coupons.forEach((c) => { if (c.type) types.add(c.type); });
  //   return Array.from(types).sort();
  // }, [coupons]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let result = coupons.filter((c) => {
      if (q && !(c.notes ?? "").toLowerCase().includes(q)) return false;
      if (typeFilter !== "All" && c.type !== typeFilter) return false;
      if (storeFilter && c.storeId !== storeFilter) return false;
      if (emailFilter.trim() && !(c.customerEmail ?? "").toLowerCase().includes(emailFilter.trim().toLowerCase())) return false;
      if (expiryFrom && firestoreToMs(c.expiryDate) < new Date(expiryFrom + "T00:00:00").getTime()) return false;
      if (expiryTo && firestoreToMs(c.expiryDate) > new Date(expiryTo + "T23:59:59").getTime()) return false;
      if (amountMin && (c.amount ?? 0) < parseFloat(amountMin)) return false;
      if (amountMax && (c.amount ?? 0) > parseFloat(amountMax)) return false;
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
  }, [coupons, search, typeFilter, storeFilter, emailFilter, expiryFrom, expiryTo, amountMin, amountMax, sortKey, sortDir]);

  const allSelected = filtered.length > 0 && filtered.every((c) => selectedIds.has(c.docId!));
  const someSelected = !allSelected && filtered.some((c) => selectedIds.has(c.docId!));

  function toggleSelectAll() {
    if (allSelected) setSelectedIds(new Set());
    else setSelectedIds(new Set(filtered.map((c) => c.docId!)));
  }

  function toggleCoupon(docId: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(docId)) next.delete(docId); else next.add(docId);
      return next;
    });
  }

  // ── Bulk handlers ──

  async function handleBulkDelete() {
    setBulkLoading(true);
    try {
      await Promise.all(Array.from(selectedIds).map((id) => CouponService.deleteCoupon(id)));
      log({
        category: LOG_CATEGORY.COUPON,
        severityLevel: LOG_SEVERITY.HIGH,
        action: "Bulk Delete Coupons",
        notes: `Admin bulk deleted ${selectedIds.size} coupon${selectedIds.size !== 1 ? "s" : ""}`,
        page: LOG_PAGE.COUPONS,
      });
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
      log({
        category: LOG_CATEGORY.COUPON,
        severityLevel: LOG_SEVERITY.HIGH,
        action: "Bulk Update Coupon Expiry",
        notes: `Admin bulk updated expiry to ${bulkExpiry} for ${selectedIds.size} coupon${selectedIds.size !== 1 ? "s" : ""}`,
        page: LOG_PAGE.COUPONS,
      });
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
      log({
        category: LOG_CATEGORY.COUPON,
        severityLevel: LOG_SEVERITY.HIGH,
        action: "Bulk Update Coupon Amount",
        notes: `Admin bulk updated amount to $${amt.toFixed(2)} for ${selectedIds.size} coupon${selectedIds.size !== 1 ? "s" : ""}`,
        page: LOG_PAGE.COUPONS,
      });
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
    const headerRow = ["docId", "type", "amount", "expiryDate", "storeId", "notes", "customerEmail", "createdAt"];
    const rows = filtered.map((c) => [
      escapeCSV(c.docId ?? ""),
      escapeCSV(c.type ?? ""),
      String(c.amount ?? ""),
      tsToISO(c.expiryDate),
      escapeCSV(c.storeId ?? ""),
      escapeCSV(c.notes ?? ""),
      escapeCSV(c.customerEmail ?? ""),
      tsToISO(c.createdAt),
    ].join(","));
    const csv = [headerRow.join(","), ...rows].join("\n");
    triggerCSVDownload(csv, `coupons-${new Date().toISOString().slice(0, 10)}.csv`);
  }

  // ── CSV Import ──

  function handleImportCSV(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const text = ev.target?.result as string;
        const { headers, rows } = parseCSVText(text);

        const protectedInFile = headers.filter((h) =>
          (COUPON_PROTECTED_FIELDS as readonly string[]).includes(h)
        );
        if (protectedInFile.length > 0) {
          toast.error(`CSV contains protected columns: ${protectedInFile.join(", ")}. Remove them and re-upload.`);
          if (fileInputRef.current) fileInputRef.current.value = "";
          return;
        }

        const storeIds = useStoreStore.getState().stores.map((s) => s.docId!);
        const existingCouponIds = useCouponStore.getState().coupons.map((c) => c.docId!);
        const validImportCols = new Set([...(COUPON_IMPORTABLE_FIELDS as readonly string[]), "docId"]);

        const validRows: Record<string, string>[] = [];
        const errors: ImportError[] = [];

        rows.forEach((cols, idx) => {
          const rowNum = idx + 2;
          const row: Record<string, string> = {};
          headers.forEach((h, i) => { row[h] = cols[i] ?? ""; });

          const unknownCols = headers.filter((h) => !validImportCols.has(h));
          unknownCols.forEach((col) =>
            errors.push({ row: rowNum, field: col, reason: `Unknown column "${col}" will be ignored` })
          );

          let hasError = false;

          if (row.docId && !existingCouponIds.includes(row.docId)) {
            errors.push({ row: rowNum, field: "docId", reason: `docId "${row.docId}" not found — will be created as new coupon` });
          }

          if (row.amount && (isNaN(parseFloat(row.amount)) || parseFloat(row.amount) < 0)) {
            errors.push({ row: rowNum, field: "amount", reason: "Must be a non-negative number" });
            hasError = true;
          }

          if (row.expiryDate && isNaN(new Date(row.expiryDate).getTime())) {
            errors.push({ row: rowNum, field: "expiryDate", reason: "Invalid date format" });
            hasError = true;
          }

          if (row.storeId && !storeIds.includes(row.storeId)) {
            errors.push({ row: rowNum, field: "storeId", reason: `Store "${row.storeId}" does not exist` });
            hasError = true;
          }

          if (!hasError) validRows.push(row);
        });

        setImportPreview({ validRows, errors });
      } catch {
        toast.error("Failed to read CSV file.");
      } finally {
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    };
    reader.readAsText(file);
  }

  async function handleConfirmImport() {
    if (!importPreview || importPreview.validRows.length === 0) return;
    setImportLoading(true);
    try {
      let count = 0;
      const existingIds = useCouponStore.getState().coupons.map((c) => c.docId!);
      for (const row of importPreview.validRows) {
        const data: Partial<Omit<Coupon, "docId">> = {};
        if (row.type) data.type = row.type;
        if (row.amount) data.amount = parseFloat(row.amount);
        if (row.expiryDate) data.expiryDate = new Date(row.expiryDate);
        if (row.storeId) data.storeId = row.storeId;
        if (row.notes) data.notes = row.notes;
        if (row.customerEmail) data.customerEmail = row.customerEmail;

        if (row.docId && existingIds.includes(row.docId)) {
          await CouponService.updateCoupon(row.docId, data);
        } else {
          await CouponService.createCoupon(data as Omit<Coupon, "docId">);
        }
        count++;
      }
      log({
        category: LOG_CATEGORY.IMPORT,
        severityLevel: LOG_SEVERITY.HIGH,
        action: "Import Coupons",
        notes: `Admin imported ${count} coupon${count !== 1 ? "s" : ""} via CSV`,
        page: LOG_PAGE.COUPONS,
      });
      toast.success(`Imported ${count} coupon(s).`);
      setImportPreview(null);
    } catch {
      toast.error("Failed to import coupons.");
    } finally {
      setImportLoading(false);
    }
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
            onClick={() => setShowImportInfo(true)}
            disabled={importLoading}
          >
            {importLoading ? "Importing…" : "Import CSV"}
          </Button> */}
           <Button variant="outline" onClick={exportToCSV} disabled={filtered.length === 0}>
            Export CSV
          </Button>
          <Button onClick={() => setShowCreate(true)}>
            New Coupon
          </Button>
         
        </div>
      </div>

      {/* Filters */}
      <CouponsFilterBar
        search={search} setSearch={setSearch}
        typeFilter={typeFilter} setTypeFilter={setTypeFilter}
        storeFilter={storeFilter} setStoreFilter={setStoreFilter}
        emailFilter={emailFilter} setEmailFilter={setEmailFilter}
        expiryFrom={expiryFrom} setExpiryFrom={setExpiryFrom}
        expiryTo={expiryTo} setExpiryTo={setExpiryTo}
        amountMin={amountMin} setAmountMin={setAmountMin}
        amountMax={amountMax} setAmountMax={setAmountMax}
        stores={stores}
        anyFilterActive={anyFilterActive}
        clearAllFilters={clearAllFilters}
      />

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
                <Checkbox
                  checked={someSelected ? "indeterminate" : allSelected}
                  onCheckedChange={toggleSelectAll}
                />
              </th>
              {/* <th className="px-5 py-3 text-left font-medium text-light-grey">Type</th> */}
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
              <th className="px-5 py-3 text-left font-medium text-light-grey">Notes</th>
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
                <td colSpan={8} className="px-5 py-10 text-center text-light-grey">
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
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => toggleCoupon(coupon.docId!)}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </td>
                    {/* <td className="px-5 py-3 text-black">{coupon.type ?? "—"}</td> */}
                    <td className="px-5 py-3 text-right text-black">
                      ${(coupon.amount ?? 0).toFixed(2)}
                    </td>
                    <td className="px-5 py-3 text-black">{formatDateTime(coupon.expiryDate)}</td>
                    <td className="max-w-[200px] truncate px-5 py-3 text-black" title={coupon.notes ?? ""}>
                      {coupon.notes ?? "—"}
                    </td>
                    <td className="px-5 py-3 text-black">{formatDateTime(coupon.createdAt)}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* CSV Field Guide Dialog */}
      <Dialog open={showImportInfo} onOpenChange={setShowImportInfo}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>CSV Import Guide — Coupons</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2 text-sm">
            <div className="space-y-1.5">
              <p className="font-medium text-black">Editable fields</p>
              <div className="flex flex-wrap gap-1.5">
                {(["type", "amount", "expiryDate", "storeId", "notes", "customerEmail"] as const).map((f) => (
                  <span key={f} className="rounded-md bg-background border border-border px-2 py-0.5 text-xs text-black font-mono">{f}</span>
                ))}
              </div>
            </div>
            <p className="text-xs text-light-grey leading-relaxed">
              Include <span className="font-mono text-black">docId</span> to update an existing coupon. Omit it to create a new one. The <span className="font-mono text-black">expiryDate</span> field accepts any valid date string.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowImportInfo(false)}>Cancel</Button>
            <Button onClick={() => { setShowImportInfo(false); fileInputRef.current?.click(); }}>
              Choose File →
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import Preview Dialog */}
      <Dialog open={importPreview !== null} onOpenChange={() => setImportPreview(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Import Preview</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {importPreview && importPreview.errors.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-sm font-medium text-black">
                  {importPreview.errors.filter((e) => e.reason.includes("ignored")).length > 0
                    ? "Warnings & Errors"
                    : "Errors"}
                </p>
                <div className="max-h-48 overflow-y-auto rounded-lg border border-border bg-background p-3 space-y-1">
                  {importPreview.errors.map((e, i) => (
                    <p key={i} className="text-xs text-black">
                      <span className="font-medium">Row {e.row}</span> — {e.field}: {e.reason}
                    </p>
                  ))}
                </div>
              </div>
            )}
            <p className="text-sm text-black">
              <span className="font-medium">{importPreview?.validRows.length ?? 0}</span> row(s) will be imported.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setImportPreview(null)} disabled={importLoading}>
              Cancel
            </Button>
            {(importPreview?.validRows.length ?? 0) > 0 && (
              <Button onClick={handleConfirmImport} disabled={importLoading}>
                {importLoading ? "Importing…" : `Import ${importPreview?.validRows.length} row(s)`}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog
        open={bulkDialog === "delete"}
        onOpenChange={(open) => { if (!open) setBulkDialog(null); }}
      >
        <DialogContent className="max-w-sm">
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
        <DialogContent className="max-w-sm">
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
        <DialogContent className="max-w-sm">
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

      <AddCouponDialog
        open={showCreate}
        onClose={() => setShowCreate(false)}
        stores={stores}
      />

    </div>
  );
}

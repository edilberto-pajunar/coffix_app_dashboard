"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useUserStore } from "./store/useUserStore";
import { useStoreStore } from "@/app/dashboard/stores/store/useStoreStore";
import { deletedRefReason } from "@/components/import/storeRefs";
import { useTransactionStore } from "@/app/dashboard/transactions/store/useTransactionStore";
import { accumulateCoffixCredit, reconcileCoffixCredit, COFFIX_CREDIT_SIGN } from "@/app/utils/coffixCredit";
import { UserService } from "./service/UserService";
import { AppUser } from "./interface/user";
import {
  USER_PROTECTED_FIELDS,
  USER_IMPORTABLE_FIELDS,
  USER_EXPORTABLE_FIELDS,
} from "./constants/userFieldConstants";
import { parseCSVText } from "@/app/utils/csvUtils";
import { exportRowsToCSV } from "@/app/utils/import";
import { SYSTEM_IMPORT_FIELDS } from "@/components/import/parseImportFile";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { UsersFilterBar } from "./components/UsersFilterBar";
import { AddCouponDialog } from "@/app/dashboard/coupons/components/AddCouponDialog";
import BulkUpdateFlagsDialog, { type FlagKey } from "./components/BulkUpdateFlagsDialog";
import { useActivityLog } from "../logs/hooks/useActivityLog";
import { LOG_CATEGORY, LOG_PAGE, LOG_SEVERITY } from "../logs/constants/logConstants";

function dateInRange(value: Date | undefined, from: string, to: string): boolean {
  if (!from && !to) return true;
  if (value === undefined || value === null) return false;
  const d: Date =
    typeof (value as unknown as { toDate?: () => Date }).toDate === "function"
      ? (value as unknown as { toDate: () => Date }).toDate()
      : (value as Date);
  if (from && d < new Date(from)) return false;
  if (to) {
    const toEnd = new Date(to);
    toEnd.setHours(23, 59, 59, 999);
    if (d > toEnd) return false;
  }
  return true;
}

function toMillis(value: unknown): number {
  if (value === undefined || value === null) return 0;
  // Firestore Timestamp instance
  if (typeof (value as { toDate?: () => Date }).toDate === "function") {
    const t = (value as { toDate: () => Date }).toDate().getTime();
    return isNaN(t) ? 0 : t;
  }
  // Real Date
  if (value instanceof Date) {
    const t = value.getTime();
    return isNaN(t) ? 0 : t;
  }
  // Serialized Timestamp: { seconds, nanoseconds } or { _seconds, _nanoseconds }
  if (typeof value === "object") {
    const o = value as { seconds?: number; _seconds?: number };
    const seconds = o.seconds ?? o._seconds;
    if (typeof seconds === "number") return seconds * 1000;
  }
  // ISO string / number
  if (typeof value === "string" || typeof value === "number") {
    const t = new Date(value).getTime();
    return isNaN(t) ? 0 : t;
  }
  return 0;
}

function getDisplayName(user: { firstName?: string; lastName?: string; nickName?: string }): string {
  const full = `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim();
  return full || user.nickName || "—";
}

function getStoreName(preferredStoreId: string | undefined, stores: { docId: string; name?: string }[]): string {
  if (!preferredStoreId) return "—";
  return stores.find((s) => s.docId === preferredStoreId)?.name ?? "—";
}

function getInitials(name: string): string {
  if (name === "—") return "?";
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

const FLAG_KEYS: FlagKey[] = [
  "getPurchaseInfoByMail", "getPromotions", "allowWinACoffee",
  "disabled", "scheduleOrder", "shareCredit", "withdrawBalance", "coffixCreditAvailable",
];

export default function UsersPage() {
  const users = useUserStore((s) => s.users);
  const stores = useStoreStore((s) => s.stores);
  const transactions = useTransactionStore((s) => s.transactions);
  const router = useRouter();

  // Re-derive each user's coffix credit from their coffixCredit transactions once,
  // so rows don't each re-scan the full transaction list.
  const accumulatedByUser = useMemo(() => {
    const userIds = new Set<string>();
    for (const tx of transactions) {
      const type = tx.type ?? "";
      if (!COFFIX_CREDIT_SIGN[type] && type !== "gift") continue;
      if (tx.customerId) userIds.add(tx.customerId);
      if (tx.recipientCustomerId) userIds.add(tx.recipientCustomerId);
    }
    const map = new Map<string, number>();
    for (const id of userIds) {
      map.set(id, accumulateCoffixCredit(transactions, id));
    }
    return map;
  }, [transactions]);

  type BoolFilter = "Any" | "Yes" | "No";
  type DateRange = { from: string; to: string };
  type NumberRange = { min: string; max: string };

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"All" | "Active" | "Disabled">("All");
  const [storeFilter, setStoreFilter] = useState<string>("All");
  type SortDir = "asc" | "desc";
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const [filterEmail, setFilterEmail] = useState("");
  const [filterDocId, setFilterDocId] = useState("");
  const [filterSuburb, setFilterSuburb] = useState("");
  const [filterCity, setFilterCity] = useState("");
  const [filterAppVersion, setFilterAppVersion] = useState("");
  const [filterQrId, setFilterQrId] = useState("");
  const [filterMobile, setFilterMobile] = useState("");
  const [filterBirthday, setFilterBirthday] = useState<DateRange>({ from: "", to: "" });
  const [filterCreatedAt, setFilterCreatedAt] = useState<DateRange>({ from: "", to: "" });
  const [filterLastLogin, setFilterLastLogin] = useState<DateRange>({ from: "", to: "" });
  const [filterCreditExpiry, setFilterCreditExpiry] = useState<DateRange>({ from: "", to: "" });
  const [filterEmailVerified, setFilterEmailVerified] = useState<BoolFilter>("Any");
  const [filterGetPurchaseInfoByMail, setFilterGetPurchaseInfoByMail] = useState<BoolFilter>("Any");
  const [filterGetPromotions, setFilterGetPromotions] = useState<BoolFilter>("Any");
  const [filterAllowWinACoffee, setFilterAllowWinACoffee] = useState<BoolFilter>("Any");
  const [filterDisabled, setFilterDisabled] = useState<BoolFilter>("Any");
  const [filterCreditAvailable, setFilterCreditAvailable] = useState<NumberRange>({ min: "", max: "" });
  const [filterBirthMonth, setFilterBirthMonth] = useState<string>("All");

  const { log } = useActivityLog();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showAddCredits, setShowAddCredits] = useState(false);
  const [showAddCoupon, setShowAddCoupon] = useState(false);
  const [showBulkFlags, setShowBulkFlags] = useState(false);
  const [creditAmount, setCreditAmount] = useState("");
  const [creditLoading, setCreditLoading] = useState(false);
  const [importLoading, setImportLoading] = useState(false);
  const [importPreview, setImportPreview] = useState<{ validRows: Record<string, string>[]; errors: { row: number; field: string; reason: string }[] } | null>(null);
  const [showImportInfo, setShowImportInfo] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function toggleSort() {
    setSortDir((d) => (d === "asc" ? "desc" : "asc"));
  }

  function clearSelection() {
    setSelectedIds(new Set());
  }

  function clearAllFilters() {
    setSearch("");
    setStoreFilter("All");
    setStatusFilter("All");
    setFilterEmail("");
    setFilterDocId("");
    setFilterSuburb("");
    setFilterCity("");
    setFilterAppVersion("");
    setFilterQrId("");
    setFilterMobile("");
    setFilterBirthday({ from: "", to: "" });
    setFilterCreatedAt({ from: "", to: "" });
    setFilterLastLogin({ from: "", to: "" });
    setFilterCreditExpiry({ from: "", to: "" });
    setFilterEmailVerified("Any");
    setFilterGetPurchaseInfoByMail("Any");
    setFilterGetPromotions("Any");
    setFilterAllowWinACoffee("Any");
    setFilterDisabled("Any");
    setFilterCreditAvailable({ min: "", max: "" });
    setFilterBirthMonth("All");
    clearSelection();
  }

  function setStoreFilterAndClear(v: string) {
    setStoreFilter(v);
    clearSelection();
  }

  const anyFilterActive = useMemo(() => {
    return (
      search.trim() !== "" ||
      storeFilter !== "All" ||
      filterEmail.trim() !== "" ||
      filterDocId.trim() !== "" ||
      filterSuburb.trim() !== "" ||
      filterCity.trim() !== "" ||
      filterAppVersion.trim() !== "" ||
      filterQrId.trim() !== "" ||
      filterMobile.trim() !== "" ||
      filterBirthday.from !== "" || filterBirthday.to !== "" ||
      filterCreatedAt.from !== "" || filterCreatedAt.to !== "" ||
      filterLastLogin.from !== "" || filterLastLogin.to !== "" ||
      filterCreditExpiry.from !== "" || filterCreditExpiry.to !== "" ||
      filterEmailVerified !== "Any" ||
      filterGetPurchaseInfoByMail !== "Any" ||
      filterGetPromotions !== "Any" ||
      filterAllowWinACoffee !== "Any" ||
      filterDisabled !== "Any" ||
      filterCreditAvailable.min !== "" || filterCreditAvailable.max !== "" ||
      filterBirthMonth !== "All"
    );
  }, [
    search, storeFilter, filterEmail, filterDocId, filterSuburb, filterCity,
    filterAppVersion, filterQrId, filterMobile, filterBirthday, filterCreatedAt,
    filterLastLogin, filterCreditExpiry, filterEmailVerified, filterGetPurchaseInfoByMail,
    filterGetPromotions, filterAllowWinACoffee, filterDisabled, filterCreditAvailable,
    filterBirthMonth,
  ]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    let result = users.filter((u) => {
      if (statusFilter === "Active" && u.disabled) return false;
      if (statusFilter === "Disabled" && !u.disabled) return false;
      if (storeFilter !== "All" && u.preferredStoreId !== storeFilter) return false;
      if (query) {
        const name = `${u.firstName ?? ""} ${u.lastName ?? ""} ${u.nickName ?? ""}`.toLowerCase();
        if (
          !name.includes(query) &&
          !(u.email ?? "").toLowerCase().includes(query) &&
          !(u.mobile ?? "").toLowerCase().includes(query)
        ) return false;
      }
      if (filterEmail.trim() && !(u.email ?? "").toLowerCase().includes(filterEmail.trim().toLowerCase())) return false;
      if (filterDocId.trim() && !(u.docId ?? "").toLowerCase().includes(filterDocId.trim().toLowerCase())) return false;
      if (filterSuburb.trim() && !(u.suburb ?? "").toLowerCase().includes(filterSuburb.trim().toLowerCase())) return false;
      if (filterCity.trim() && !(u.city ?? "").toLowerCase().includes(filterCity.trim().toLowerCase())) return false;
      if (filterAppVersion.trim() && !(u.appVersion ?? "").toLowerCase().includes(filterAppVersion.trim().toLowerCase())) return false;
      if (filterQrId.trim() && !(u.qrId ?? "").toLowerCase().includes(filterQrId.trim().toLowerCase())) return false;
      if (filterMobile.trim() && !(u.mobile ?? "").toLowerCase().includes(filterMobile.trim().toLowerCase())) return false;
      if (!dateInRange(u.birthday, filterBirthday.from, filterBirthday.to)) return false;
      if (filterBirthMonth !== "All") {
        if (!u.birthday) return false;
        const bd = typeof (u.birthday as unknown as { toDate?: () => Date }).toDate === "function"
          ? (u.birthday as unknown as { toDate: () => Date }).toDate()
          : (u.birthday as Date);
        if (bd.getMonth() + 1 !== Number(filterBirthMonth)) return false;
      }
      if (!dateInRange(u.createdAt, filterCreatedAt.from, filterCreatedAt.to)) return false;
      if (!dateInRange(u.lastLogin, filterLastLogin.from, filterLastLogin.to)) return false;
      if (!dateInRange(u.creditExpiry, filterCreditExpiry.from, filterCreditExpiry.to)) return false;
      if (filterEmailVerified !== "Any" && !!u.emailVerified !== (filterEmailVerified === "Yes")) return false;
      if (filterGetPurchaseInfoByMail !== "Any" && !!u.getPurchaseInfoByMail !== (filterGetPurchaseInfoByMail === "Yes")) return false;
      if (filterGetPromotions !== "Any" && !!u.getPromotions !== (filterGetPromotions === "Yes")) return false;
      if (filterAllowWinACoffee !== "Any" && !!u.allowWinACoffee !== (filterAllowWinACoffee === "Yes")) return false;
      if (filterDisabled !== "Any" && !!u.disabled !== (filterDisabled === "Yes")) return false;
      if (filterCreditAvailable.min !== "") {
        const min = parseFloat(filterCreditAvailable.min);
        if (!isNaN(min) && (u.creditAvailable ?? 0) < min) return false;
      }
      if (filterCreditAvailable.max !== "") {
        const max = parseFloat(filterCreditAvailable.max);
        if (!isNaN(max) && (u.creditAvailable ?? 0) > max) return false;
      }
      return true;
    });
    result = [...result].sort((a, b) => {
      const aTime = toMillis(a.createdAt);
      const bTime = toMillis(b.createdAt);
      if (bTime !== aTime) return bTime - aTime;
      const cmp = getDisplayName(a).localeCompare(getDisplayName(b));
      return sortDir === "asc" ? cmp : -cmp;
    });
    return result;
  }, [
    users, search, statusFilter, storeFilter, sortDir,
    filterEmail, filterDocId, filterSuburb, filterCity, filterAppVersion,
    filterQrId, filterMobile, filterBirthday, filterCreatedAt, filterLastLogin,
    filterCreditExpiry, filterEmailVerified, filterGetPurchaseInfoByMail,
    filterGetPromotions, filterAllowWinACoffee, filterDisabled, filterCreditAvailable,
    filterBirthMonth,
  ]);

  const bulkInitialFlags = useMemo(() => {
    const selected = Array.from(selectedIds)
      .map((id) => users.find((u) => u.docId === id))
      .filter(Boolean) as AppUser[];
    if (selected.length === 0) return {} as Partial<Record<FlagKey, boolean>>;
    const result: Partial<Record<FlagKey, boolean>> = {};
    for (const key of FLAG_KEYS) {
      const trueCount = selected.filter((u) => u[key] === true).length;
      result[key] = trueCount > selected.length / 2;
    }
    return result;
  }, [selectedIds, users]);

  const allSelected = filtered.length > 0 && filtered.every((u) => selectedIds.has(u.docId!));
  const someSelected = !allSelected && filtered.some((u) => selectedIds.has(u.docId!));

  function toggleSelectAll() {
    if (allSelected) {
      clearSelection();
    } else {
      setSelectedIds(new Set(filtered.map((u) => u.docId!)));
    }
  }

  function toggleUser(docId: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(docId)) next.delete(docId);
      else next.add(docId);
      return next;
    });
  }

  function exportToCSV() {
    const date = new Date().toISOString().slice(0, 10);
    exportRowsToCSV(filtered, USER_EXPORTABLE_FIELDS, "users", `${date}-customers.csv`);
  }

  function handleImportCSV(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const text = ev.target?.result as string;
        const { headers, rows } = parseCSVText(text);

        const protectedInFile = headers.filter((h) =>
          (USER_PROTECTED_FIELDS as readonly string[]).includes(h) &&
          !(SYSTEM_IMPORT_FIELDS as readonly string[]).includes(h)
        );
        if (protectedInFile.length > 0) {
          toast.error(`CSV contains protected columns: ${protectedInFile.join(", ")}. Remove them and re-upload.`);
          if (fileInputRef.current) fileInputRef.current.value = "";
          return;
        }

        const existingUserIds = useUserStore.getState().users.map((u) => u.docId!);
        const storeIds = useStoreStore.getState().stores.map((s) => s.docId!);
        const allStoreIds = useStoreStore.getState().allStores.map((s) => s.docId!);
        const validImportCols = new Set([...(USER_IMPORTABLE_FIELDS as readonly string[]), ...(SYSTEM_IMPORT_FIELDS as readonly string[])]);

        const validRows: Record<string, string>[] = [];
        const errors: { row: number; field: string; reason: string }[] = [];

        rows.forEach((cols, idx) => {
          const rowNum = idx + 2;
          const row: Record<string, string> = {};
          headers.forEach((h, i) => { row[h] = cols[i] ?? ""; });

          headers.filter((h) => !validImportCols.has(h)).forEach((col) =>
            errors.push({ row: rowNum, field: col, reason: `Unknown column "${col}" will be ignored` })
          );

          let hasError = false;

          if (!row.docId) {
            errors.push({ row: rowNum, field: "docId", reason: "docId is required to identify the user" });
            hasError = true;
          } else if (!existingUserIds.includes(row.docId)) {
            errors.push({ row: rowNum, field: "docId", reason: "User not found — cannot update" });
            hasError = true;
          }

          if (row.preferredStoreId && !storeIds.includes(row.preferredStoreId)) {
            errors.push({
              row: rowNum,
              field: "preferredStoreId",
              reason: allStoreIds.includes(row.preferredStoreId)
                ? deletedRefReason("Store", row.preferredStoreId)
                : `Store "${row.preferredStoreId}" does not exist`,
            });
            hasError = true;
          }

          if (row.birthday && isNaN(new Date(row.birthday).getTime())) {
            errors.push({ row: rowNum, field: "birthday", reason: "Invalid date format" });
            hasError = true;
          }

          for (const boolField of ["disabled", "getPurchaseInfoByMail", "getPromotions", "allowWinACoffee"] as const) {
            if (row[boolField] !== undefined && row[boolField] !== "" &&
              !["true", "false"].includes(row[boolField].toLowerCase())) {
              errors.push({ row: rowNum, field: boolField, reason: 'Must be "true" or "false"' });
              hasError = true;
            }
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
      for (const row of importPreview.validRows) {
        const update: Record<string, unknown> = {};
        const strFields = ["firstName", "lastName", "nickName", "mobile", "suburb", "city", "preferredStoreId"] as const;
        strFields.forEach((f) => { if (row[f] !== undefined) update[f] = row[f]; });
        if (row.birthday) update.birthday = new Date(row.birthday);
        for (const f of ["disabled", "getPurchaseInfoByMail", "getPromotions", "allowWinACoffee"] as const) {
          if (row[f] !== undefined && row[f] !== "") update[f] = row[f].toLowerCase() === "true";
        }
        await UserService.updateUser(row.docId, update);
        count++;
      }
      log({
        category: LOG_CATEGORY.IMPORT,
        severityLevel: LOG_SEVERITY.HIGH,
        action: "Import Customers",
        notes: `Admin updated ${count} customer${count !== 1 ? "s" : ""} via CSV`,
        page: LOG_PAGE.CUSTOMERS,
      });
      toast.success(`Updated ${count} user(s).`);
      setImportPreview(null);
    } catch {
      toast.error("Failed to import users.");
    } finally {
      setImportLoading(false);
    }
  }

  // No try/catch by design — BulkUpdateFlagsDialog owns the toasts and needs
  // the rejection to propagate.
  async function handleBulkUpdateFlags(flags: Partial<AppUser>) {
    const affectedCount = selectedIds.size;
    await Promise.all(
      Array.from(selectedIds).map((docId) =>
        UserService.updateUser(docId, flags)
      )
    );
    log({
      category: LOG_CATEGORY.CUSTOMERS,
      severityLevel: LOG_SEVERITY.HIGH,
      action: "Bulk Update Customer Flags",
      notes: `Admin bulk updated ${Object.keys(flags).join(", ")} for ${affectedCount} customer${affectedCount !== 1 ? "s" : ""}`,
      page: LOG_PAGE.CUSTOMERS,
    });
  }

  async function handleAddCredits() {
    const amount = parseFloat(creditAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error("Enter a valid credit amount greater than 0.");
      return;
    }
    setCreditLoading(true);
    // Captured before clearSelection() empties the set.
    const affectedCount = selectedIds.size;
    try {
      const res = await fetch("/api/credit/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userIds: Array.from(selectedIds), amount }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error ?? data?.message ?? `Error ${res.status}`);
      }
      log({
        category: LOG_CATEGORY.CUSTOMERS,
        severityLevel: LOG_SEVERITY.HIGH,
        action: "Add Customer Credits",
        notes: `Admin added $${amount.toFixed(2)} credits to ${affectedCount} customer${affectedCount !== 1 ? "s" : ""}`,
        page: LOG_PAGE.CUSTOMERS,
      });
      toast.success(`Added $${amount.toFixed(2)} credits to ${affectedCount} user(s).`);
      setShowAddCredits(false);
      setCreditAmount("");
      clearSelection();
    } catch (err) {
      toast.error("Failed to add credits.", {
        description: err instanceof Error ? err.message : "Something went wrong.",
      });
    } finally {
      setCreditLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-black">Customers</h1>
          <p className="mt-1 text-sm text-light-grey">
            {users.length} customer{users.length !== 1 ? "s" : ""} total
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
          <Button
            variant="outline"
            onClick={exportToCSV}
            disabled={filtered.length === 0}
          >
            Export CSV
          </Button>
        </div>
      </div>

      <UsersFilterBar
        search={search} setSearch={setSearch}
        filterEmail={filterEmail} setFilterEmail={setFilterEmail}
        filterDocId={filterDocId} setFilterDocId={setFilterDocId}
        filterMobile={filterMobile} setFilterMobile={setFilterMobile}
        filterSuburb={filterSuburb} setFilterSuburb={setFilterSuburb}
        filterCity={filterCity} setFilterCity={setFilterCity}
        filterQrId={filterQrId} setFilterQrId={setFilterQrId}
        filterAppVersion={filterAppVersion} setFilterAppVersion={setFilterAppVersion}
        storeFilter={storeFilter} setStoreFilter={setStoreFilterAndClear}
        stores={stores}
        filterBirthday={filterBirthday} setFilterBirthday={setFilterBirthday}
        filterBirthMonth={filterBirthMonth} setFilterBirthMonth={setFilterBirthMonth}
        filterCreatedAt={filterCreatedAt} setFilterCreatedAt={setFilterCreatedAt}
        filterLastLogin={filterLastLogin} setFilterLastLogin={setFilterLastLogin}
        filterCreditExpiry={filterCreditExpiry} setFilterCreditExpiry={setFilterCreditExpiry}
        filterEmailVerified={filterEmailVerified} setFilterEmailVerified={setFilterEmailVerified}
        filterDisabled={filterDisabled} setFilterDisabled={setFilterDisabled}
        filterGetPurchaseInfoByMail={filterGetPurchaseInfoByMail} setFilterGetPurchaseInfoByMail={setFilterGetPurchaseInfoByMail}
        filterGetPromotions={filterGetPromotions} setFilterGetPromotions={setFilterGetPromotions}
        filterAllowWinACoffee={filterAllowWinACoffee} setFilterAllowWinACoffee={setFilterAllowWinACoffee}
        filterCreditAvailable={filterCreditAvailable} setFilterCreditAvailable={setFilterCreditAvailable}
        anyFilterActive={anyFilterActive}
        clearAllFilters={clearAllFilters}
      />

      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 rounded-xl border border-border bg-white px-5 py-3 shadow-(--shadow)">
          <span className="text-sm text-light-grey">{selectedIds.size} selected</span>
          <Button
            size="sm"
            onClick={() => setShowAddCredits(true)}
          >
            Add Credits
          </Button>
          <Button
            size="sm"
            onClick={() => setShowAddCoupon(true)}
          >
            Add Coupon
          </Button>
          <Button
            size="sm"
            onClick={() => setShowBulkFlags(true)}
          >
            Update Flags
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={clearSelection}
          >
            Clear
          </Button>
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-border bg-white shadow-(--shadow)">
        <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] table-fixed text-sm">
          <thead>
            <tr className="border-b border-border bg-background">
              <th className="w-10 px-5 py-3">
                <Checkbox
                  checked={someSelected ? "indeterminate" : allSelected}
                  onCheckedChange={toggleSelectAll}
                />
              </th>
              <th
                onClick={() => toggleSort()}
                className="w-64 cursor-pointer select-none px-5 py-3 text-left font-medium text-light-grey"
              >
                Name {sortDir === "asc" ? "↑" : "↓"}
              </th>
              <th className="px-5 py-3 text-left font-medium text-light-grey">Email</th>
              <th className="px-5 py-3 text-left font-medium text-light-grey">Preferred Store</th>
              <th className="w-36 px-5 py-3 text-right font-medium text-light-grey">Coffix Credit</th>
              <th className="w-36 px-5 py-3 text-right font-medium text-light-grey">Accumulated</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-5 py-10 text-center text-light-grey">
                  No customers found.
                </td>
              </tr>
            ) : (
              filtered.map((user) => {
                const displayName = getDisplayName(user);
                const initials = getInitials(displayName);
                const isSelected = selectedIds.has(user.docId!);
                const currentCredit = user.creditAvailable ?? 0;
                const accumulatedCredit = accumulatedByUser.get(user.docId!) ?? 0;
                const reconciliation = reconcileCoffixCredit(currentCredit, accumulatedCredit);
                return (
                  <tr
                    key={user.docId}
                    onClick={() => router.push(`/dashboard/users/${user.docId}`)}
                    className={`transition-colors hover:bg-background cursor-pointer ${isSelected ? "bg-background" : ""}`}
                  >
                    <td
                      className="px-5 py-3"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleUser(user.docId!);
                      }}
                    >
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => toggleUser(user.docId!)}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary text-xs font-bold text-white">
                          {initials}
                        </div>
                        <span className="truncate font-medium text-black">{displayName}</span>
                      </div>
                    </td>
                    <td className="truncate px-5 py-3 text-black">{user.email ?? "—"}</td>
                    <td className="truncate px-5 py-3 text-black">{getStoreName(user.preferredStoreId, stores)}</td>
                    <td className="px-5 py-3 text-right text-black tabular-nums">
                      ${currentCredit.toFixed(2)}
                    </td>
                    <td
                      className={`px-5 py-3 text-right tabular-nums ${reconciliation.matches ? "text-black" : "font-medium text-red-600"}`}
                    >
                      ${accumulatedCredit.toFixed(2)}
                      {!reconciliation.matches && <span className="ml-1">⚠</span>}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
        </div>
      </div>

      <Dialog open={showAddCredits} onOpenChange={(open) => { if (!open) { setShowAddCredits(false); setCreditAmount(""); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Add Credits</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-light-grey">
              Adding credits to <span className="font-medium text-black">{selectedIds.size}</span> user{selectedIds.size !== 1 ? "s" : ""}.
            </p>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-black">Amount ($)</label>
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={creditAmount}
                onChange={(e) => setCreditAmount(e.target.value)}
                placeholder="0.00"
                className="h-9 w-full rounded-lg border border-border bg-white px-3 text-sm text-black outline-none placeholder:text-light-grey focus:border-primary"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowAddCredits(false); setCreditAmount(""); }} disabled={creditLoading}>
              Cancel
            </Button>
            <Button onClick={handleAddCredits} disabled={creditLoading}>
              {creditLoading ? "Applying…" : "Apply Credits"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* CSV Field Guide Dialog */}
      <Dialog open={showImportInfo} onOpenChange={setShowImportInfo}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>CSV Import Guide — Customers</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2 text-sm">
            <div className="space-y-1.5">
              <p className="font-medium text-black">Editable fields</p>
              <div className="flex flex-wrap gap-1.5">
                {(["firstName", "lastName", "nickName", "mobile", "birthday", "suburb", "city", "preferredStoreId", "getPurchaseInfoByMail", "getPromotions", "allowWinACoffee", "disabled"] as const).map((f) => (
                  <span key={f} className="rounded-md bg-background border border-border px-2 py-0.5 text-xs text-black font-mono">{f}</span>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <p className="font-medium text-black">Required fields <span className="text-xs font-normal text-light-grey">(for new rows)</span></p>
              <p className="text-xs text-light-grey">None — every row must include an existing <span className="font-mono text-black">docId</span>.</p>
            </div>
            <p className="text-xs text-light-grey leading-relaxed">
              This entity is <span className="font-medium text-black">update-only</span>. Every row must include a valid <span className="font-mono text-black">docId</span>. Boolean fields accept <span className="font-mono text-black">true</span> or <span className="font-mono text-black">false</span>. The <span className="font-mono text-black">birthday</span> field accepts any valid date string.
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
                <p className="text-sm font-medium text-black">Errors</p>
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
              <span className="font-medium">{importPreview?.validRows.length ?? 0}</span> row(s) will be updated.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setImportPreview(null)} disabled={importLoading}>
              Cancel
            </Button>
            {(importPreview?.validRows.length ?? 0) > 0 && (
              <Button onClick={handleConfirmImport} disabled={importLoading}>
                {importLoading ? "Updating…" : `Update ${importPreview?.validRows.length} row(s)`}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AddCouponDialog
        open={showAddCoupon}
        onClose={() => setShowAddCoupon(false)}
        stores={stores}
        userIds={Array.from(selectedIds)}
        defaultEmails={Array.from(selectedIds).map((id) => users.find((u) => u.docId === id)?.email ?? "").filter(Boolean)}
      />

      <BulkUpdateFlagsDialog
        key={showBulkFlags ? "open" : "closed"}
        open={showBulkFlags}
        onClose={() => setShowBulkFlags(false)}
        selectedCount={selectedIds.size}
        initialFlags={bulkInitialFlags}
        onSave={handleBulkUpdateFlags}
      />
    </div>
  );
}

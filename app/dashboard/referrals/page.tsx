"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useReferralStore } from "./store/useReferralStore";
import { useUserStore } from "@/app/dashboard/users/store/useUserStore";
import { ReferralService } from "./service/ReferralService";
import { Referral } from "./interface/referral";
import {
  REFERRAL_PROTECTED_FIELDS,
  REFERRAL_IMPORTABLE_FIELDS,
  REFERRAL_EXPORTABLE_FIELDS,
} from "./constants/referralFieldConstants";
import { parseCSVText } from "@/app/utils/csvUtils";
import { exportRowsToCSV } from "@/app/utils/import";
import { SYSTEM_IMPORT_FIELDS } from "@/components/import/parseImportFile";
import { Button } from "@/components/ui/button";
import { ReferralsFilterBar } from "./components/ReferralsFilterBar";
import { formatDateTime } from "@/app/utils/formatting";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

type StatusFilter = "All" | "Active" | "Disabled";
type SortKey = "referralTime" | "referrer" | "referee";
type SortDir = "asc" | "desc";
type ImportError = { row: number; field: string; reason: string };
type ImportPreview = { validRows: Record<string, string>[]; errors: ImportError[] } | null;

function getTimestamp(value: unknown): number {
  if (!value) return 0;
  if (value instanceof Date) return value.getTime();
  if (typeof value === "object" && value !== null && "seconds" in value) {
    return (value as { seconds: number }).seconds * 1000;
  }
  return 0;
}

function SortIcon({ col, sortKey, sortDir }: { col: SortKey; sortKey: SortKey; sortDir: SortDir }) {
  if (sortKey !== col) return <span className="opacity-30">↕</span>;
  return <span>{sortDir === "asc" ? "↑" : "↓"}</span>;
}

export default function ReferralsPage() {
  const referrals = useReferralStore((s) => s.referrals);
  const users = useUserStore((s) => s.users);
  const router = useRouter();

  function referrerEmail(customerId: string | undefined): string {
    if (!customerId) return "—";
    const user = users.find((u) => u.docId === customerId);
    return user?.email ?? customerId;
  }

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("All");

  const anyFilterActive = useMemo(
    () => search.trim() !== "" || statusFilter !== "All",
    [search, statusFilter]
  );

  function clearAllFilters() {
    setSearch("");
    setStatusFilter("All");
  }

  const [sortKey, setSortKey] = useState<SortKey>("referralTime");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [importLoading, setImportLoading] = useState(false);
  const [importPreview, setImportPreview] = useState<ImportPreview>(null);
  const [showImportInfo, setShowImportInfo] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("asc"); }
  }

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    let result = referrals.filter((r) => {
      // if (statusFilter === "Active" && r.disabled) return false;
      // if (statusFilter === "Disabled" && !r.disabled) return false;
      if (query) {
        return (
          (r.referrer ?? "").toLowerCase().includes(query) ||
          (r.referee ?? "").toLowerCase().includes(query)
        );
      }
      return true;
    });

    result = [...result].sort((a, b) => {
      let cmp = 0;
      if (sortKey === "referralTime") {
        cmp = getTimestamp(a.referralTime) - getTimestamp(b.referralTime);
      } else if (sortKey === "referrer") {
        cmp = (a.referrer ?? "").localeCompare(b.referrer ?? "");
      } else {
        cmp = (a.referee ?? "").localeCompare(b.referee ?? "");
      }
      return sortDir === "asc" ? cmp : -cmp;
    });

    return result;
  }, [referrals, search, statusFilter, sortKey, sortDir]);

  function exportToCSV() {
    exportRowsToCSV(filtered, REFERRAL_EXPORTABLE_FIELDS, "referrals");
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
          (REFERRAL_PROTECTED_FIELDS as readonly string[]).includes(h) &&
          !(SYSTEM_IMPORT_FIELDS as readonly string[]).includes(h)
        );
        if (protectedInFile.length > 0) {
          toast.error(`CSV contains protected columns: ${protectedInFile.join(", ")}. Remove them and re-upload.`);
          if (fileInputRef.current) fileInputRef.current.value = "";
          return;
        }

        const existingReferralIds = useReferralStore.getState().referrals.map((r) => r.docId!);
        const validImportCols = new Set([...(REFERRAL_IMPORTABLE_FIELDS as readonly string[]), ...(SYSTEM_IMPORT_FIELDS as readonly string[])]);

        const validRows: Record<string, string>[] = [];
        const errors: ImportError[] = [];

        rows.forEach((cols, idx) => {
          const rowNum = idx + 2;
          const row: Record<string, string> = {};
          headers.forEach((h, i) => { row[h] = cols[i] ?? ""; });

          headers.filter((h) => !validImportCols.has(h)).forEach((col) =>
            errors.push({ row: rowNum, field: col, reason: `Unknown column "${col}" will be ignored` })
          );

          let hasError = false;

          if (!row.docId) {
            errors.push({ row: rowNum, field: "docId", reason: "docId is required to identify the referral" });
            hasError = true;
          } else if (!existingReferralIds.includes(row.docId)) {
            errors.push({ row: rowNum, field: "docId", reason: "Referral not found — cannot update" });
            hasError = true;
          }

          // if (row.disabled !== undefined && row.disabled !== "" &&
          //   !["true", "false"].includes(row.disabled.toLowerCase())) {
          //   errors.push({ row: rowNum, field: "disabled", reason: 'Must be "true" or "false"' });
          //   hasError = true;
          // }

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
        const update: Partial<Omit<Referral, "docId">> = {};
        // if (row.disabled !== undefined && row.disabled !== "") {
        //   update.disabled = row.disabled.toLowerCase() === "true";
        // }
        await ReferralService.updateReferral(row.docId, update);
        count++;
      }
      toast.success(`Updated ${count} referral(s).`);
      setImportPreview(null);
    } catch {
      toast.error("Failed to import referrals.");
    } finally {
      setImportLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-black">Referrals</h1>
          <p className="mt-1 text-sm text-black">
            {referrals.length} referral{referrals.length !== 1 ? "s" : ""} total
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
              onClick={exportToCSV}
              variant="outline"
            disabled={filtered.length === 0}
          >
            Export CSV
          </Button>
        </div>
      </div>

      <ReferralsFilterBar
        search={search} setSearch={setSearch}
        statusFilter={statusFilter} setStatusFilter={(v) => setStatusFilter(v as StatusFilter)}
        anyFilterActive={anyFilterActive}
        clearAllFilters={clearAllFilters}
      />

      <div className="overflow-hidden rounded-xl border border-border bg-white shadow-(--shadow)">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-background">
              <th
                onClick={() => toggleSort("referrer")}
                className="cursor-pointer select-none px-5 py-3 text-left font-medium text-black hover:text-primary"
              >
                Referrer <SortIcon col="referrer" sortKey={sortKey} sortDir={sortDir} />
              </th>
              <th
                onClick={() => toggleSort("referee")}
                className="cursor-pointer select-none px-5 py-3 text-left font-medium text-black hover:text-primary"
              >
                Referee <SortIcon col="referee" sortKey={sortKey} sortDir={sortDir} />
              </th>
              <th
                onClick={() => toggleSort("referralTime")}
                className="cursor-pointer select-none px-5 py-3 text-left font-medium text-black hover:text-primary"
              >
                Date & Time <SortIcon col="referralTime" sortKey={sortKey} sortDir={sortDir} />
              </th>
              <th className="px-5 py-3 text-left font-medium text-black">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-5 py-10 text-center text-black">
                  No referrals found.
                </td>
              </tr>
            ) : (
              filtered.map((referral) => (
                <tr
                  key={referral.docId}
                  onClick={() => router.push(`/dashboard/referrals/${referral.docId}`)}
                  className="cursor-pointer transition-colors hover:bg-background"
                >
                  <td className="px-5 py-3 text-black">
                    {referrerEmail(referral.referrer)}
                  </td>
                  <td className="px-5 py-3 text-black">{referral.referee ?? "—"}</td>
                  <td className="px-5 py-3 text-black">
                    {formatDateTime(referral.referralTime)}
                  </td>
                  <td className="px-5 py-3">
                    {/* {referral.disabled ? ( */}    
                      {/* <span className="inline-flex items-center gap-1.5 rounded-full bg-black px-2.5 py-1 text-xs font-medium text-white">
                        <span className="h-1.5 w-1.5 rounded-full bg-white" />
                        Disabled
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-success px-2.5 py-1 text-xs font-medium text-white">
                        <span className="h-1.5 w-1.5 rounded-full bg-white" />
                        Active
                      </span>
                    )} */}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* CSV Field Guide Dialog */}
      <Dialog open={showImportInfo} onOpenChange={setShowImportInfo}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>CSV Import Guide — Referrals</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2 text-sm">
            <div className="space-y-1.5">
              <p className="font-medium text-black">Editable fields</p>
              <div className="flex flex-wrap gap-1.5">
                <span className="rounded-md bg-background border border-border px-2 py-0.5 text-xs text-black font-mono">disabled</span>
              </div>
            </div>
            <div className="space-y-1.5">
              <p className="font-medium text-black">Required fields <span className="text-xs font-normal text-light-grey">(for new rows)</span></p>
              <p className="text-xs text-light-grey">None — every row must include an existing <span className="font-mono text-black">docId</span>.</p>
            </div>
            <p className="text-xs text-light-grey leading-relaxed">
              This entity is <span className="font-medium text-black">update-only</span>. Every row must include a valid <span className="font-mono text-black">docId</span>. The <span className="font-mono text-black">disabled</span> field accepts <span className="font-mono text-black">true</span> or <span className="font-mono text-black">false</span>.
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
    </div>
  );
}

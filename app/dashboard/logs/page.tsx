"use client";

import { useMemo, useState } from "react";
import { useLogStore } from "./store/useLogStore";
import { Log } from "./interface/log";
import { formatDateTime } from "@/app/utils/formatting";
import { useUserStore } from "@/app/dashboard/users/store/useUserStore";
import { useStaffStore } from "@/app/dashboard/staffs/store/useStaffStore";
import { escapeCSV, tsToISO, triggerCSVDownload } from "@/app/utils/csvUtils";
import { Button } from "@/components/ui/button";
import { LogsFilterBar } from "./components/LogsFilterBar";
import { LogSettingsDialog } from "./components/LogSettingsDialog";
import { Pagination } from "@/components/ui/pagination";

type DateRange = { from: string; to: string };

const PAGE_SIZE = 50;

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

function uniqueValues(logs: Log[], selector: (log: Log) => string | undefined): string[] {
  return Array.from(
    new Set(logs.map(selector).filter((v): v is string => !!v && v.trim() !== ""))
  ).sort();
}

const SEVERITY_STYLES: Record<number, string> = {
  1: "bg-blue-100 text-blue-700",
  3: "bg-yellow-100 text-yellow-700",
  5: "bg-orange-100 text-orange-700",
  9: "bg-red-100 text-red-700",
};

function SeverityBadge({ level }: { level?: number }) {
  if (level === undefined || level === null) return <span className="text-light-grey">—</span>;
  const style = SEVERITY_STYLES[level] ?? "bg-gray-100 text-gray-500";
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${style}`}>
      {level}
    </span>
  );
}

/**
 * Logs are written by both customers (customerId) and staff (userId), so fall
 * back to the staff email when the row has no resolvable customer email.
 */
function resolveEmail(
  log: Log,
  userEmailMap: Map<string | undefined, string | undefined>,
  staffEmailMap: Map<string, string>
): string | undefined {
  return (
    (log.customerId ? userEmailMap.get(log.customerId) : undefined) ??
    (log.userId ? staffEmailMap.get(log.userId) : undefined)
  );
}

function matches(
  log: Log,
  q: string,
  userEmailMap: Map<string | undefined, string | undefined>,
  staffEmailMap: Map<string, string>
): boolean {
  const email = resolveEmail(log, userEmailMap, staffEmailMap);
  return [log.action, log.category, log.page, log.notes, log.userId, log.customerId, email]
    .some((v) => v?.toLowerCase().includes(q));
}

export default function LogsPage() {
  const logs = useLogStore((s) => s.logs);
  const logSettings = useLogStore((s) => s.logSettings);
  const users = useUserStore((s) => s.users);
  const staffs = useStaffStore((s) => s.staffs);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState("All");
  const [filterAction, setFilterAction] = useState("All");
  const [filterSeverity, setFilterSeverity] = useState<number | "">("");
  const [filterPage, setFilterPage] = useState("");
  const [filterNotes, setFilterNotes] = useState("");
  const [filterTime, setFilterTime] = useState<DateRange>({ from: "", to: "" });
  const [currentPage, setCurrentPage] = useState(1);

  const userEmailMap = useMemo(
    () => new Map(users.map((u) => [u.docId, u.email])),
    [users]
  );

  const staffEmailMap = useMemo(
    () => new Map(staffs.map((s) => [s.docId, s.email])),
    [staffs]
  );

  const uniqueCategories = useMemo(() => uniqueValues(logs, (l) => l.category), [logs]);
  const uniqueActions = useMemo(() => uniqueValues(logs, (l) => l.action), [logs]);

  const anyFilterActive = useMemo(
    () =>
      search.trim() !== "" ||
      filterCategory !== "All" ||
      filterAction !== "All" ||
      filterSeverity !== "" ||
      filterPage.trim() !== "" ||
      filterNotes.trim() !== "" ||
      filterTime.from !== "" ||
      filterTime.to !== "",
    [search, filterCategory, filterAction, filterSeverity, filterPage, filterNotes, filterTime]
  );

  function clearAllFilters() {
    setSearch("");
    setFilterCategory("All");
    setFilterAction("All");
    setFilterSeverity("");
    setFilterPage("");
    setFilterNotes("");
    setFilterTime({ from: "", to: "" });
  }

  const displayed = useMemo(() => {
    const q = search.trim().toLowerCase();
    const page = filterPage.trim().toLowerCase();
    const notes = filterNotes.trim().toLowerCase();
    return logs.filter((log) => {
      if (q && !matches(log, q, userEmailMap, staffEmailMap)) return false;
      if (filterCategory !== "All" && log.category !== filterCategory) return false;
      if (filterAction !== "All" && log.action !== filterAction) return false;
      if (filterSeverity !== "" && log.severityLevel !== filterSeverity) return false;
      if (page && !(log.page ?? "").toLowerCase().includes(page)) return false;
      if (notes && !(log.notes ?? "").toLowerCase().includes(notes)) return false;
      if (!dateInRange(log.time, filterTime.from, filterTime.to)) return false;
      return true;
    });
  }, [logs, search, filterCategory, filterAction, filterSeverity, filterPage, filterNotes, filterTime, userEmailMap, staffEmailMap]);

  // Filtering can shrink the results out from under the selected page, so clamp
  // during render rather than correcting it afterwards in an effect.
  const pageCount = Math.max(1, Math.ceil(displayed.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, pageCount);

  const paginated = useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE;
    return displayed.slice(start, start + PAGE_SIZE);
  }, [displayed, safePage]);

  function exportToCSV() {
    const headers = ["docId", "time", "page", "category", "severityLevel", "action", "notes", "customerId", "userId"];
    const rows = displayed.map((log) =>
      [
        escapeCSV(log.docId ?? ""),
        escapeCSV(tsToISO(log.time) || formatDateTime(log.time)),
        escapeCSV(log.page ?? ""),
        escapeCSV(log.category ?? ""),
        escapeCSV(String(log.severityLevel ?? "")),
        escapeCSV(log.action ?? ""),
        escapeCSV(log.notes ?? ""),
        escapeCSV(log.customerId ?? ""),
        escapeCSV(log.userId ?? ""),
      ].join(",")
    );
    triggerCSVDownload([headers.join(","), ...rows].join("\n"), `logs-${new Date().toISOString().slice(0, 10)}.csv`);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-black">Logs</h1>
          <p className="mt-1 text-sm text-light-grey">
            {logs.length} log{logs.length !== 1 ? "s" : ""} total
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setSettingsOpen(true)}>
            Settings
          </Button>
          <Button variant="outline" onClick={exportToCSV} disabled={displayed.length === 0}>
            Export CSV
          </Button>
        </div>
      </div>

      <LogSettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        settings={logSettings}
      />

      <LogsFilterBar
        search={search} setSearch={setSearch}
        filterCategory={filterCategory} setFilterCategory={setFilterCategory}
        categories={uniqueCategories}
        filterAction={filterAction} setFilterAction={setFilterAction}
        actions={uniqueActions}
        filterSeverity={filterSeverity} setFilterSeverity={setFilterSeverity}
        filterPage={filterPage} setFilterPage={setFilterPage}
        filterNotes={filterNotes} setFilterNotes={setFilterNotes}
        filterTime={filterTime} setFilterTime={setFilterTime}
        anyFilterActive={anyFilterActive}
        clearAllFilters={clearAllFilters}
      />

      <div className="overflow-hidden rounded-xl border border-border bg-white shadow-(--shadow)">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-background">
              <th className="px-5 py-3 text-left font-medium text-light-grey">Email</th>
              <th className="px-5 py-3 text-left font-medium text-light-grey">Action</th>
              <th className="px-5 py-3 text-left font-medium text-light-grey">Category</th>
              <th className="px-5 py-3 text-left font-medium text-light-grey">Severity</th>
              <th className="px-5 py-3 text-left font-medium text-light-grey">Page</th>
              <th className="px-5 py-3 text-left font-medium text-light-grey">Notes</th>
              <th className="px-5 py-3 text-left font-medium text-light-grey">Time</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {displayed.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-5 py-10 text-center text-light-grey">
                  No logs found.
                </td>
              </tr>
            ) : (
              paginated.map((log) => (
                <tr
                  key={log.docId}
                  className="transition-colors hover:bg-background"
                >
                  <td className="px-5 py-3 text-black">{resolveEmail(log, userEmailMap, staffEmailMap) ?? "N/A"}</td>
                  <td className="px-5 py-3 text-black">{log.action ?? "—"}</td>
                  <td className="px-5 py-3 text-black">{log.category ?? "—"}</td>
                  <td className="px-5 py-3">
                    <SeverityBadge level={log.severityLevel} />
                  </td>
                  <td className="px-5 py-3 text-black">{log.page ?? "—"}</td>
                  <td className="px-5 py-3 text-black">{log.notes ?? "—"}</td>
                  <td className="px-5 py-3 text-black">{formatDateTime(log.time)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        <Pagination
          currentPage={safePage}
          totalItems={displayed.length}
          pageSize={PAGE_SIZE}
          onPageChange={setCurrentPage}
          className="border-t border-border"
        />
      </div>
    </div>
  );
}

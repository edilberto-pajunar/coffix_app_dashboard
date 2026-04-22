"use client";

import { useMemo, useState } from "react";
import { useLogStore } from "./store/useLogStore";
import { Log } from "./interface/log";
import { formatDateTime } from "@/app/utils/formatting";

const SEVERITY_STYLES: Record<string, string> = {
  error: "bg-red-100 text-red-700",
  warning: "bg-yellow-100 text-yellow-700",
  info: "bg-blue-100 text-blue-700",
  success: "bg-green-100 text-green-700",
};

function SeverityBadge({ level }: { level?: string }) {
  if (!level) return <span className="text-light-grey">—</span>;
  const style = SEVERITY_STYLES[level.toLowerCase()] ?? "bg-gray-100 text-gray-500";
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${style}`}>
      {level}
    </span>
  );
}

function matches(log: Log, q: string): boolean {
  return [log.action, log.category, log.page, log.notes, log.userId, log.customerId]
    .some((v) => v?.toLowerCase().includes(q));
}

export default function LogsPage() {
  const logs = useLogStore((s) => s.logs);
  const [search, setSearch] = useState("");

  const displayed = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return logs;
    return logs.filter((log) => matches(log, q));
  }, [logs, search]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-black">Logs</h1>
        <p className="mt-1 text-sm text-light-grey">
          {logs.length} log{logs.length !== 1 ? "s" : ""} total
        </p>
      </div>

      <input
        type="text"
        placeholder="Search by action, category, page, notes…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="h-9 w-full rounded-lg border border-border bg-white px-3 text-sm text-black outline-none placeholder:text-light-grey focus:border-primary sm:max-w-xs"
      />

      <div className="overflow-hidden rounded-xl border border-border bg-white shadow-(--shadow)">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-background">
              <th className="px-5 py-3 text-left font-medium text-light-grey">Time</th>
              <th className="px-5 py-3 text-left font-medium text-light-grey">Action</th>
              <th className="px-5 py-3 text-left font-medium text-light-grey">Category</th>
              <th className="px-5 py-3 text-left font-medium text-light-grey">Severity</th>
              <th className="px-5 py-3 text-left font-medium text-light-grey">Page</th>
              <th className="px-5 py-3 text-left font-medium text-light-grey">Notes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {displayed.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-5 py-10 text-center text-light-grey">
                  No logs found.
                </td>
              </tr>
            ) : (
              displayed.map((log) => (
                <tr key={log.docId} className="transition-colors hover:bg-background">
                  <td className="px-5 py-3 text-black">{formatDateTime(log.time)}</td>
                  <td className="px-5 py-3 text-black">{log.action ?? "—"}</td>
                  <td className="px-5 py-3 text-black">{log.category ?? "—"}</td>
                  <td className="px-5 py-3">
                    <SeverityBadge level={log.severityLevel} />
                  </td>
                  <td className="px-5 py-3 text-black">{log.page ?? "—"}</td>
                  <td className="px-5 py-3 text-black">{log.notes ?? "—"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useReferralStore } from "./store/useReferralStore";
import { useUserStore } from "@/app/dashboard/users/store/useUserStore";
import { Referral } from "./interface/referral";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/app/utils/formatting";

type StatusFilter = "All" | "Active" | "Disabled";
type SortKey = "referralTime" | "referrer" | "referee";
type SortDir = "asc" | "desc";

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

function exportCSV(rows: Referral[]) {
  const header = "Referrer,Referee,Time,Disabled";
  const lines = rows.map((r) =>
    [
      r.referrer ?? "",
      r.referee ?? "",
      formatDateTime(r.referralTime),
      r.disabled ? "Yes" : "No",
    ]
      .map((v) => `"${String(v).replace(/"/g, '""')}"`)
      .join(",")
  );
  const csv = [header, ...lines].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "referrals.csv";
  a.click();
  URL.revokeObjectURL(url);
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
  const [sortKey, setSortKey] = useState<SortKey>("referralTime");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("asc"); }
  }

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    let result = referrals.filter((r) => {
      if (statusFilter === "Active" && r.disabled) return false;
      if (statusFilter === "Disabled" && !r.disabled) return false;
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-black">Referrals</h1>
          <p className="mt-1 text-sm text-black">
            {referrals.length} referral{referrals.length !== 1 ? "s" : ""} total
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => exportCSV(filtered)}
          disabled={filtered.length === 0}
        >
          Export CSV
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <input
          type="text"
          placeholder="Search by referrer or referee…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-9 w-full rounded-lg border border-border bg-white px-3 text-sm text-black outline-none placeholder:text-black focus:border-primary sm:max-w-xs"
        />
        <div className="flex flex-wrap gap-2">
          {(["All", "Active", "Disabled"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setStatusFilter(v)}
              className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                statusFilter === v
                  ? "border-primary bg-primary text-white"
                  : "border-border text-black hover:bg-soft-grey hover:text-white"
              }`}
            >
              {v === "All" ? "All Statuses" : v}
            </button>
          ))}
        </div>
      </div>

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
                    {referral.disabled ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-black px-2.5 py-1 text-xs font-medium text-white">
                        <span className="h-1.5 w-1.5 rounded-full bg-white" />
                        Disabled
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-success px-2.5 py-1 text-xs font-medium text-white">
                        <span className="h-1.5 w-1.5 rounded-full bg-white" />
                        Active
                      </span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useUserStore } from "./store/useUserStore";

function formatDate(value: unknown): string {
  if (!value) return "—";
  if (value instanceof Date) return value.toLocaleDateString();
  if (typeof value === "object" && value !== null && "seconds" in value) {
    return new Date((value as { seconds: number }).seconds * 1000).toLocaleDateString();
  }
  return "—";
}

function getDisplayName(user: { firstName?: string; lastName?: string; nickName?: string }): string {
  const full = `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim();
  return full || user.nickName || "—";
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

export default function UsersPage() {
  const users = useUserStore((s) => s.users);
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"All" | "Active" | "Disabled">("All");
  type UserSortKey = "name" | "credit" | "createdAt";
  type SortDir = "asc" | "desc";
  const [sortKey, setSortKey] = useState<UserSortKey>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  function toggleSort(key: UserSortKey) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("asc"); }
  }

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    let result = users.filter((u) => {
      if (statusFilter === "Active" && u.disabled) return false;
      if (statusFilter === "Disabled" && !u.disabled) return false;
      if (query) {
        const name = `${u.firstName ?? ""} ${u.lastName ?? ""} ${u.nickName ?? ""}`.toLowerCase();
        return (
          name.includes(query) ||
          (u.email ?? "").toLowerCase().includes(query) ||
          (u.mobile ?? "").toLowerCase().includes(query)
        );
      }
      return true;
    });
    result = [...result].sort((a, b) => {
      let cmp = 0;
      if (sortKey === "name") {
        const na = getDisplayName(a);
        const nb = getDisplayName(b);
        cmp = na.localeCompare(nb);
      } else if (sortKey === "credit") {
        cmp = (a.creditAvailable ?? 0) - (b.creditAvailable ?? 0);
      } else {
        const getTs = (u: typeof a) => {
          const v = u.createdAt;
          if (!v) return 0;
          if (v instanceof Date) return v.getTime();
          if (typeof v === "object" && "seconds" in (v as object)) return (v as { seconds: number }).seconds * 1000;
          return 0;
        };
        cmp = getTs(a) - getTs(b);
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return result;
  }, [users, search, statusFilter, sortKey, sortDir]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-black">Users</h1>
          <p className="mt-1 text-sm text-light-grey">
            {users.length} user{users.length !== 1 ? "s" : ""} total
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <input
          type="text"
          placeholder="Search by name, email or mobile…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-9 w-full rounded-lg border border-border bg-white px-3 text-sm text-black outline-none placeholder:text-light-grey focus:border-primary sm:max-w-xs"
        />
        <div className="flex flex-wrap gap-2">
          {(["All", "Active", "Disabled"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setStatusFilter(v)}
              className={`rounded-full border px-3 py-1 text-xs transition-colors ${statusFilter === v ? "border-primary bg-primary text-white" : "border-border text-black hover:bg-soft-grey"}`}
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
                onClick={() => toggleSort("name")}
                className="cursor-pointer select-none px-5 py-3 text-left font-medium text-light-grey hover:text-black"
              >
                Name {sortKey === "name" ? (sortDir === "asc" ? "↑" : "↓") : <span className="opacity-30">↕</span>}
              </th>
              <th className="px-5 py-3 text-left font-medium text-light-grey">Email</th>
              <th className="px-5 py-3 text-left font-medium text-light-grey">Mobile</th>
              <th
                onClick={() => toggleSort("credit")}
                className="cursor-pointer select-none px-5 py-3 text-right font-medium text-light-grey hover:text-black"
              >
                Credit {sortKey === "credit" ? (sortDir === "asc" ? "↑" : "↓") : <span className="opacity-30">↕</span>}
              </th>
              <th className="px-5 py-3 text-left font-medium text-light-grey">Status</th>
              <th
                onClick={() => toggleSort("createdAt")}
                className="cursor-pointer select-none px-5 py-3 text-left font-medium text-light-grey hover:text-black"
              >
                Created At {sortKey === "createdAt" ? (sortDir === "asc" ? "↑" : "↓") : <span className="opacity-30">↕</span>}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-5 py-10 text-center text-light-grey">
                  No users found.
                </td>
              </tr>
            ) : (
              filtered.map((user) => {
                const displayName = getDisplayName(user);
                const initials = getInitials(displayName);
                return (
                  <tr
                    key={user.docId}
                    onClick={() => router.push(`/dashboard/users/${user.docId}`)}
                    className="transition-colors hover:bg-background cursor-pointer"
                  >
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary text-xs font-bold text-white">
                          {initials}
                        </div>
                        <span className="font-medium text-black">{displayName}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-black">{user.email ?? "—"}</td>
                    <td className="px-5 py-3 text-black">{user.mobile ?? "—"}</td>
                    <td className="px-5 py-3 text-right text-black">
                      ${(user.creditAvailable ?? 0).toFixed(2)}
                    </td>
                    <td className="px-5 py-3">
                      {user.disabled ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-black px-2.5 py-1 text-xs font-medium text-white">
                          <span className="h-1.5 w-1.5 rounded-full bg-white" />
                          Disabled
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-green-50 px-2.5 py-1 text-xs font-medium text-success">
                          <span className="h-1.5 w-1.5 rounded-full bg-success" />
                          Active
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-black">{formatDate(user.createdAt)}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

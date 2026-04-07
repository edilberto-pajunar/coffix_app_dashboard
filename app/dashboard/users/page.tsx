"use client";

import { useState } from "react";
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

  const query = search.trim().toLowerCase();
  const filtered = users.filter((u) => {
    if (!query) return true;
    const name = `${u.firstName ?? ""} ${u.lastName ?? ""} ${u.nickName ?? ""}`.toLowerCase();
    return (
      name.includes(query) ||
      (u.email ?? "").toLowerCase().includes(query) ||
      (u.mobile ?? "").toLowerCase().includes(query)
    );
  });

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

      <div>
        <input
          type="text"
          placeholder="Search by name, email or mobile…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full max-w-sm rounded-lg border border-border bg-white px-3 py-2 text-sm text-black outline-none focus:border-primary"
        />
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-white shadow-(--shadow)">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-background">
              <th className="px-5 py-3 text-left font-medium text-light-grey">Name</th>
              <th className="px-5 py-3 text-left font-medium text-light-grey">Email</th>
              <th className="px-5 py-3 text-left font-medium text-light-grey">Mobile</th>
              <th className="px-5 py-3 text-right font-medium text-light-grey">Credit</th>
              <th className="px-5 py-3 text-left font-medium text-light-grey">Status</th>
              <th className="px-5 py-3 text-left font-medium text-light-grey">Created At</th>
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
                    onClick={() => router.push(`/users/${user.docId}`)}
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

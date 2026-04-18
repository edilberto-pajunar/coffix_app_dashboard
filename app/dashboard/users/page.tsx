"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useUserStore } from "./store/useUserStore";
import { useStoreStore } from "@/app/dashboard/stores/store/useStoreStore";
import { UserService } from "./service/UserService";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

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

export default function UsersPage() {
  const users = useUserStore((s) => s.users);
  const stores = useStoreStore((s) => s.stores);
  const router = useRouter();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"All" | "Active" | "Disabled">("All");
  const [storeFilter, setStoreFilter] = useState<string>("All");
  type UserSortKey = "name" | "credit" | "createdAt";
  type SortDir = "asc" | "desc";
  const [sortKey, setSortKey] = useState<UserSortKey>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showAddCredits, setShowAddCredits] = useState(false);
  const [creditAmount, setCreditAmount] = useState("");
  const [creditLoading, setCreditLoading] = useState(false);

  function toggleSort(key: UserSortKey) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("asc"); }
  }

  function clearSelection() {
    setSelectedIds(new Set());
  }

  function setStatusFilterAndClear(v: "All" | "Active" | "Disabled") {
    setStatusFilter(v);
    clearSelection();
  }

  function setStoreFilterAndClear(v: string) {
    setStoreFilter(v);
    clearSelection();
  }

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    let result = users.filter((u) => {
      if (statusFilter === "Active" && u.disabled) return false;
      if (statusFilter === "Disabled" && !u.disabled) return false;
      if (storeFilter !== "All" && u.preferredStoreId !== storeFilter) return false;
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
  }, [users, search, statusFilter, storeFilter, sortKey, sortDir]);

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

  async function handleAddCredits() {
    const amount = parseFloat(creditAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error("Enter a valid credit amount greater than 0.");
      return;
    }
    setCreditLoading(true);
    try {
      await Promise.all(
        Array.from(selectedIds).map((docId) => {
          const user = users.find((u) => u.docId === docId);
          const newCredit = (user?.creditAvailable ?? 0) + amount;
          return UserService.updateUser(docId, { creditAvailable: newCredit });
        })
      );
      toast.success(`Added $${amount.toFixed(2)} credits to ${selectedIds.size} user(s).`);
      setShowAddCredits(false);
      setCreditAmount("");
      clearSelection();
    } catch {
      toast.error("Failed to add credits. Please try again.");
    } finally {
      setCreditLoading(false);
    }
  }

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
              onClick={() => setStatusFilterAndClear(v)}
              className={`rounded-full border px-3 py-1 text-xs transition-colors ${statusFilter === v ? "border-primary bg-primary text-white" : "border-border text-black hover:bg-soft-grey"}`}
            >
              {v === "All" ? "All Statuses" : v}
            </button>
          ))}
        </div>
        {stores.length > 0 && (
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setStoreFilterAndClear("All")}
              className={`rounded-full border px-3 py-1 text-xs transition-colors ${storeFilter === "All" ? "border-primary bg-primary text-white" : "border-border text-black hover:bg-soft-grey"}`}
            >
              All Stores
            </button>
            {stores.map((store) => (
              <button
                key={store.docId}
                onClick={() => setStoreFilterAndClear(store.docId)}
                className={`rounded-full border px-3 py-1 text-xs transition-colors ${storeFilter === store.docId ? "border-primary bg-primary text-white" : "border-border text-black hover:bg-soft-grey"}`}
              >
                {store.name ?? store.docId}
              </button>
            ))}
          </div>
        )}
      </div>

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
            variant="ghost"
            onClick={clearSelection}
          >
            Clear
          </Button>
        </div>
      )}

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
                <td colSpan={7} className="px-5 py-10 text-center text-light-grey">
                  No users found.
                </td>
              </tr>
            ) : (
              filtered.map((user) => {
                const displayName = getDisplayName(user);
                const initials = getInitials(displayName);
                const isSelected = selectedIds.has(user.docId!);
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
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleUser(user.docId!)}
                        onClick={(e) => e.stopPropagation()}
                        className="h-4 w-4 cursor-pointer accent-primary"
                      />
                    </td>
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

      <Dialog open={showAddCredits} onOpenChange={(open) => { if (!open) { setShowAddCredits(false); setCreditAmount(""); } }}>
        <DialogContent>
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
    </div>
  );
}

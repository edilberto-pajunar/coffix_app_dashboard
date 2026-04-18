"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useTransactionStore } from "./store/useTransactionStore";
import { useUserStore } from "@/app/dashboard/users/store/useUserStore";
import { Transaction, PaymentMethod } from "./interface/transaction";
import { formatDateTime } from "@/app/utils/formatting";

function PaymentMethodBadge({ method }: { method: PaymentMethod | null | undefined }) {
  if (!method) return <span className="text-black">—</span>;
  const styles: Record<PaymentMethod, string> = {
    coffixCredit: "bg-primary text-white",
    card: "bg-black text-white",
    wallet: "border border-border text-black",
  };
  const labels: Record<PaymentMethod, string> = {
    coffixCredit: "Coffix Credit",
    card: "Card",
    wallet: "Wallet",
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${styles[method]}`}>
      {labels[method]}
    </span>
  );
}

type SortKey = "createdAt" | "transactionNumber" | "paymentMethod";
type SortDir = "asc" | "desc";

export default function TransactionsPage() {
  const transactions = useTransactionStore((s) => s.transactions);
  const users = useUserStore((s) => s.users);
  const router = useRouter();

  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("All");
  const [methodFilter, setMethodFilter] = useState<"All" | PaymentMethod>("All");
  const [sortKey, setSortKey] = useState<SortKey>("createdAt");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("asc"); }
  }

  function getCustomerEmail(tx: Transaction): string {
    if (tx.customerId) {
      const user = users.find((u) => u.docId === tx.customerId);
      if (user?.email) return user.email;
    }
    return tx.recipientEmail ?? "—";
  }

  const uniqueTypes = useMemo(() => {
    const types = new Set<string>();
    transactions.forEach((tx) => { if (tx.type) types.add(tx.type); });
    return Array.from(types).sort();
  }, [transactions]);

  const displayed = useMemo(() => {
    const q = search.trim().toLowerCase();
    let result = transactions.filter((tx) => {
      if (typeFilter !== "All" && tx.type !== typeFilter) return false;
      if (methodFilter !== "All" && tx.paymentMethod !== methodFilter) return false;
      if (q) {
        const email = getCustomerEmail(tx).toLowerCase();
        const num = (tx.transactionNumber ?? "").toLowerCase();
        if (!email.includes(q) && !num.includes(q)) return false;
      }
      return true;
    });
    result = [...result].sort((a, b) => {
      let cmp = 0;
      if (sortKey === "createdAt") {
        cmp = new Date(a.createdAt ?? 0).getTime() - new Date(b.createdAt ?? 0).getTime();
      } else if (sortKey === "transactionNumber") {
        cmp = (a.transactionNumber ?? "").localeCompare(b.transactionNumber ?? "");
      } else {
        cmp = (a.paymentMethod ?? "").localeCompare(b.paymentMethod ?? "");
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return result;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transactions, users, search, typeFilter, methodFilter, sortKey, sortDir]);

  const sortIndicator = (key: SortKey) =>
    sortKey === key ? (sortDir === "asc" ? "↑" : "↓") : <span className="opacity-30">↕</span>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-black">Transactions</h1>
          <p className="mt-1 text-sm text-light-grey">
            {transactions.length} transaction{transactions.length !== 1 ? "s" : ""} total
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <input
          type="text"
          placeholder="Search by number or email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-9 w-full rounded-lg border border-border bg-white px-3 text-sm text-black outline-none placeholder:text-light-grey focus:border-primary sm:max-w-xs"
        />

        {uniqueTypes.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {(["All", ...uniqueTypes] as string[]).map((v) => (
              <button
                key={v}
                onClick={() => setTypeFilter(v)}
                className={`rounded-full border px-3 py-1 text-xs transition-colors ${typeFilter === v ? "border-primary bg-primary text-white" : "border-border text-black "}`}
              >
                {v === "All" ? "All Types" : v}
              </button>
            ))}
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          {(["All", "coffixCredit", "card", "wallet"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setMethodFilter(v)}
              className={`rounded-full border px-3 py-1 text-xs transition-colors ${methodFilter === v ? "border-primary bg-primary text-white" : "border-border text-black "}`}
            >
              {v === "All" ? "All Methods" : v === "coffixCredit" ? "Coffix Credit" : v === "card" ? "Card" : "Wallet"}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-white shadow-(--shadow)">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-background">
              <th
                onClick={() => toggleSort("transactionNumber")}
                className="cursor-pointer select-none px-5 py-3 text-left font-medium text-light-grey hover:text-black"
              >
                Transaction # {sortIndicator("transactionNumber")}
              </th>
              <th
                onClick={() => toggleSort("createdAt")}
                className="cursor-pointer select-none px-5 py-3 text-left font-medium text-light-grey hover:text-black"
              >
                Created At {sortIndicator("createdAt")}
              </th>
              <th
                onClick={() => toggleSort("paymentMethod")}
                className="cursor-pointer select-none px-5 py-3 text-left font-medium text-light-grey hover:text-black"
              >
                Payment Method {sortIndicator("paymentMethod")}
              </th>
              <th className="px-5 py-3 text-left font-medium text-light-grey">Type</th>
              <th className="px-5 py-3 text-left font-medium text-light-grey">Customer Email</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {displayed.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-5 py-10 text-center text-light-grey">
                  No transactions found.
                </td>
              </tr>
            ) : (
              displayed.map((tx) => (
                <tr
                  key={tx.docId}
                  onClick={() => router.push(`/dashboard/transactions/${tx.docId}`)}
                  className="cursor-pointer transition-colors hover:bg-background"
                >
                  <td className="px-5 py-3 font-mono text-black">
                    {tx.transactionNumber ?? "—"}
                  </td>
                  <td className="px-5 py-3 text-black">{formatDateTime(tx.createdAt)}</td>
                  <td className="px-5 py-3">
                    <PaymentMethodBadge method={tx.paymentMethod} />
                  </td>
                  <td className="px-5 py-3 text-black">{tx.type ?? "—"}</td>
                  <td className="px-5 py-3 text-black">{getCustomerEmail(tx)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

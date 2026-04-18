"use client";

import { useParams, useRouter } from "next/navigation";
import { useTransactionStore } from "../store/useTransactionStore";
import { useUserStore } from "@/app/dashboard/users/store/useUserStore";
import { PaymentMethod } from "../interface/transaction";
import { Item } from "../interface/order";
import { formatDateTime } from "@/app/utils/formatting";

function formatISO(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const d = value instanceof Date ? value : new Date(value);
  if (isNaN(d.getTime())) return "—";
  const pad = (n: number) => String(n).padStart(2, "0");
  const h = d.getHours();
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(h % 12 || 12)}:${pad(d.getMinutes())} ${h >= 12 ? "PM" : "AM"}`;
}

function InfoRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between px-4 py-3">
      <span className="text-xs text-light-grey">{label}</span>
      <span
        className={`max-w-xs truncate text-right text-sm text-black ${mono ? "font-mono" : ""}`}
        title={value}
      >
        {value}
      </span>
    </div>
  );
}

function InfoCard({ title, rows }: { title: string; rows: { label: string; value: string; mono?: boolean }[] }) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-white shadow-(--shadow)">
      <div className="border-b border-border px-4 py-3">
        <h2 className="font-semibold text-black">{title}</h2>
      </div>
      <div className="divide-y divide-border">
        {rows.map(({ label, value, mono }) => (
          <InfoRow key={label} label={label} value={value} mono={mono} />
        ))}
      </div>
    </div>
  );
}

function PaymentMethodBadge({ method }: { method: PaymentMethod | null | undefined }) {
  if (!method) return <span className="text-sm text-black">—</span>;
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

function formatModifiers(item: Item): string {
  if (!item.selectedModifiers) return "—";
  const entries = Object.entries(item.selectedModifiers);
  if (entries.length === 0) return "—";
  return entries.map(([k, v]) => `${k}: ${v}`).join(", ");
}

export default function TransactionDetailPage() {
  const { transactionId } = useParams<{ transactionId: string }>();
  const router = useRouter();

  const transactions = useTransactionStore((s) => s.transactions);
  const orders = useTransactionStore((s) => s.orders);
  const users = useUserStore((s) => s.users);

  const tx = transactions.find((t) => t.docId === transactionId);

  if (!tx) {
    return (
      <div className="flex h-64 items-center justify-center text-light-grey">
        Transaction not found.
      </div>
    );
  }

  const customer = tx.customerId ? users.find((u) => u.docId === tx.customerId) : undefined;
  const customerName =
    [customer?.firstName, customer?.lastName].filter(Boolean).join(" ") ||
    customer?.nickName ||
    "—";

  const order = tx.orderId ? orders.find((o) => o.docId === tx.orderId) : undefined;

  const hasRecipient = !!(tx.recipientCustomerId || tx.recipientEmail);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <button
            onClick={() => router.push("/dashboard/transactions")}
            className="mb-2 text-xs text-light-grey hover:text-black"
          >
            ← Back to Transactions
          </button>
          <h1 className="font-mono text-2xl font-semibold text-black">
            {tx.transactionNumber ?? tx.docId ?? "—"}
          </h1>
          <p className="mt-1 text-sm text-light-grey">{formatDateTime(tx.createdAt)}</p>
        </div>
        <div className="pt-6">
          <PaymentMethodBadge method={tx.paymentMethod} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Transaction Details */}
        <InfoCard
          title="Transaction Details"
          rows={[
            { label: "Transaction Number", value: tx.transactionNumber ?? "—", mono: true },
            { label: "Doc ID", value: tx.docId ?? "—", mono: true },
            { label: "Type", value: tx.type ?? "—" },
            { label: "Status", value: tx.status ?? "—" },
            { label: "Amount", value: tx.amount != null ? `$${tx.amount.toFixed(2)}` : "—" },
            { label: "Total Amount", value: tx.totalAmount != null ? `$${tx.totalAmount.toFixed(2)}` : "—" },
            { label: "GST", value: tx.gst != null ? `${tx.gst}%` : "—" },
            { label: "GST Amount", value: tx.gstAmount != null ? `$${tx.gstAmount.toFixed(2)}` : "—" },
            { label: "GST Number", value: tx.gstNumber != null ? String(tx.gstNumber) : "—" },
            { label: "Payment ID", value: tx.paymentId ?? "—", mono: true },
            { label: "Payment Time", value: formatDateTime(tx.paymentTime) },
            { label: "Created At", value: formatDateTime(tx.createdAt) },
          ]}
        />

        {/* Customer */}
        <InfoCard
          title="Customer"
          rows={[
            { label: "Customer ID", value: tx.customerId ?? "—", mono: true },
            { label: "Email", value: customer?.email ?? "—" },
            { label: "Full Name", value: customerName },
          ]}
        />

        {/* Recipient — only if present */}
        {hasRecipient && (
          <InfoCard
            title="Recipient"
            rows={[
              { label: "Recipient Customer ID", value: tx.recipientCustomerId ?? "—", mono: true },
              { label: "Recipient Email", value: tx.recipientEmail ?? "—" },
              { label: "Recipient Full Name", value: tx.recipientFullName ?? "—" },
            ]}
          />
        )}

        {/* Order — only if linked */}
        {order && (
          <div className={`overflow-hidden rounded-xl border border-border bg-white shadow-(--shadow) ${hasRecipient ? "" : "lg:col-span-2"}`}>
            <div className="border-b border-border px-4 py-3">
              <h2 className="font-semibold text-black">Order</h2>
            </div>
            <div className="divide-y divide-border">
              <InfoRow label="Order ID" value={order.docId ?? "—"} mono />
              <InfoRow label="Store" value={order.storeName ?? order.storeId ?? "—"} />
              <InfoRow label="Status" value={order.status ?? "—"} />
              <InfoRow label="Payment Status" value={order.paymentStatus ?? "—"} />
              <InfoRow label="Amount" value={order.amount != null ? `$${order.amount.toFixed(2)}` : "—"} />
              <InfoRow label="Scheduled At" value={formatISO(order.scheduledAt)} />
              <InfoRow label="Created At" value={formatISO(order.createdAt)} />
            </div>

            {/* Items table */}
            {order.items && order.items.length > 0 && (
              <div className="border-t border-border">
                <div className="px-4 py-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-light-grey">Items</p>
                </div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-background">
                      <th className="px-4 py-2 text-left font-medium text-light-grey">Product</th>
                      <th className="px-4 py-2 text-center font-medium text-light-grey">Qty</th>
                      <th className="px-4 py-2 text-right font-medium text-light-grey">Price</th>
                      <th className="px-4 py-2 text-left font-medium text-light-grey">Modifiers</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {order.items.map((item, i) => (
                      <tr key={i}>
                        <td className="px-4 py-2 text-black">{item.productName ?? "—"}</td>
                        <td className="px-4 py-2 text-center text-black">{item.quantity ?? "—"}</td>
                        <td className="px-4 py-2 text-right text-black">
                          {item.price != null ? `$${item.price.toFixed(2)}` : "—"}
                        </td>
                        <td className="px-4 py-2 text-black">{formatModifiers(item)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

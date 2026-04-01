"use client";

import { useParams, useRouter } from "next/navigation";
import { useUserStore } from "../store/useUserStore";

function formatDate(value: unknown): string {
  if (!value) return "—";
  if (value instanceof Date) return value.toLocaleDateString();
  if (typeof value === "object" && value !== null && "seconds" in value) {
    return new Date((value as { seconds: number }).seconds * 1000).toLocaleDateString();
  }
  return "—";
}

function formatBool(value: boolean | undefined): string {
  if (value === true) return "Yes";
  if (value === false) return "No";
  return "—";
}

function InfoRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between px-4 py-3">
      <span className="text-xs text-light-grey">{label}</span>
      <span className={`text-sm text-black ${mono ? "font-mono" : ""} max-w-xs truncate text-right`} title={value}>
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

export default function UserDetailPage() {
  const { userId } = useParams<{ userId: string }>();
  const router = useRouter();
  const users = useUserStore((s) => s.users);
  const user = users.find((u) => u.docId === userId);

  if (!user) {
    return (
      <div className="flex h-64 items-center justify-center text-light-grey">
        User not found.
      </div>
    );
  }

  const displayName =
    `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() ||
    user.nickName ||
    "—";

  return (
    <div className="space-y-6">
      <div>
        <button
          onClick={() => router.push("/users")}
          className="mb-3 text-xs text-light-grey hover:text-black transition-colors"
        >
          ← Back to Users
        </button>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold text-black">{displayName}</h1>
          {user.disabled ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-soft-grey px-2.5 py-1 text-xs font-medium text-light-grey">
              <span className="h-1.5 w-1.5 rounded-full bg-light-grey" />
              Disabled
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-green-50 px-2.5 py-1 text-xs font-medium text-success">
              <span className="h-1.5 w-1.5 rounded-full bg-success" />
              Active
            </span>
          )}
        </div>
        <p className="mt-1 font-mono text-sm text-light-grey">{user.email ?? "—"}</p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <InfoCard
          title="Personal Info"
          rows={[
            { label: "First Name", value: user.firstName ?? "—" },
            { label: "Last Name", value: user.lastName ?? "—" },
            { label: "Nickname", value: user.nickName ?? "—" },
            { label: "Email", value: user.email ?? "—" },
            { label: "Mobile", value: user.mobile ?? "—" },
            { label: "Birthday", value: formatDate(user.birthday) },
          ]}
        />

        <InfoCard
          title="Location"
          rows={[
            { label: "Suburb", value: user.suburb ?? "—" },
            { label: "City", value: user.city ?? "—" },
          ]}
        />

        <InfoCard
          title="Account"
          rows={[
            { label: "Doc ID", value: user.docId ?? "—", mono: true },
            { label: "QR ID", value: user.qrId ?? "—", mono: true },
            { label: "Credit Available", value: `$${(user.creditAvailable ?? 0).toFixed(2)}` },
            { label: "Created At", value: formatDate(user.createdAt) },
            { label: "Last Login", value: formatDate(user.lastLogin) },
            { label: "Email Verified", value: formatBool(user.emailVerified) },
            { label: "Disabled", value: formatBool(user.disabled) },
          ]}
        />

        <InfoCard
          title="Preferences"
          rows={[
            { label: "Preferred Store ID", value: user.preferredStoreId ?? "—", mono: true },
            { label: "Purchase Info by Mail", value: formatBool(user.getPurchaseInfoByMail) },
            { label: "Get Promotions", value: formatBool(user.getPromotions) },
            { label: "Allow Win a Coffee", value: formatBool(user.allowWinACoffee) },
          ]}
        />

        <div className="lg:col-span-2">
          <InfoCard
            title="Technical"
            rows={[
              { label: "FCM Token", value: user.fcmToken ?? "—", mono: true },
            ]}
          />
        </div>
      </div>
    </div>
  );
}

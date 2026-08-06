"use client";

import { useParams, useRouter } from "next/navigation";
import { useReferralStore } from "../store/useReferralStore";
import { useUserStore } from "@/app/dashboard/users/store/useUserStore";
import { formatDateTime } from "@/app/utils/formatting";
import { Button } from "@/components/ui/button";

function InfoRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between px-4 py-3">
      <span className="text-xs text-black">{label}</span>
      <span
        className={`text-sm text-black ${mono ? "font-mono" : ""} max-w-xs truncate text-right`}
        title={value}
      >
        {value}
      </span>
    </div>
  );
}

function InfoCard({
  title,
  rows,
}: {
  title: string;
  rows: { label: string; value: string; mono?: boolean }[];
}) {
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

export default function ReferralDetailPage() {
  const params = useParams();
  const router = useRouter();
  const referralId = params.referralId as string;

  const referral = useReferralStore((s) =>
    s.referrals.find((r) => r.docId === referralId)
  );
  const users = useUserStore((s) => s.users);

  const referrerEmail = referral?.referrer
    ? (users.find((u) => u.docId === referral.referrer)?.email ?? referral.referrer)
    : "—";

  if (!referral) {
    return (
      <div className="space-y-6">
        <Button
          onClick={() => router.push("/dashboard/referrals")}
            variant="outline"
            size="sm"
        >
          ← Back to Referrals
        </Button>
        <p className="text-black">Referral not found.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
          <Button
          onClick={() => router.push("/dashboard/referrals")}
          variant="outline"
          size="sm"
        >
          ← Back to Referrals
        </Button>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-black">Referral Detail</h1>
          <p className="mt-1 font-mono text-xs text-black">{referral.docId}</p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1.5 text-xs font-medium text-black">
          <span className="h-1.5 w-1.5 rounded-full bg-black" />
          {referral.status ?? "—"}
        </span>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <InfoCard
          title="Referral Info"
          rows={[
            { label: "Referrer", value: referrerEmail },
            { label: "Referee (Email)", value: referral.referee ?? "—" },
            { label: "Status", value: referral.status ?? "—" },
            { label: "Referral Time", value: formatDateTime(referral.referralTime) },
            { label: "Signup Time", value: formatDateTime(referral.signupTime) },
            { label: "Valid Time", value: formatDateTime(referral.validTime) },
          ]}
        />
        <InfoCard
          title="Identifiers"
          rows={[
            { label: "Document ID", value: referral.docId ?? "—", mono: true },
            { label: "Coupon ID", value: referral.couponId ?? "—", mono: true },
            {
              label: "Referee Coupon ID",
              value: referral.refereeCouponId ?? "—",
              mono: true,
            },
          ]}
        />
      </div>
    </div>
  );
}

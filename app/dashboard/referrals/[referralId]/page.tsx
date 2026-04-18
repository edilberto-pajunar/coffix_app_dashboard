"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useReferralStore } from "../store/useReferralStore";
import { useUserStore } from "@/app/dashboard/users/store/useUserStore";
import { ReferralService } from "../service/ReferralService";
import { formatDateTime } from "@/app/utils/formatting";

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

  const [toggling, setToggling] = useState(false);

  async function handleToggleDisabled() {
    if (!referral?.docId) return;
    setToggling(true);
    try {
      await ReferralService.updateReferral(referral.docId, {
        disabled: !referral.disabled,
      });
      toast.success(
        referral.disabled ? "Referral re-enabled." : "Referral disabled."
      );
    } catch {
      toast.error("Failed to update referral. Please try again.");
    } finally {
      setToggling(false);
    }
  }

  if (!referral) {
    return (
      <div className="space-y-6">
        <button
          onClick={() => router.push("/dashboard/referrals")}
          className="text-sm text-black hover:text-primary"
        >
          ← Back to Referrals
        </button>
        <p className="text-black">Referral not found.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <button
          onClick={() => router.push("/dashboard/referrals")}
          className="text-sm text-black hover:text-primary"
        >
          ← Back to Referrals
        </button>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-black">Referral Detail</h1>
          <p className="mt-1 font-mono text-xs text-black">{referral.docId}</p>
        </div>
        <div className="flex items-center gap-3">
          {referral.disabled ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-black px-3 py-1.5 text-xs font-medium text-white">
              <span className="h-1.5 w-1.5 rounded-full bg-white" />
              Disabled
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-success px-3 py-1.5 text-xs font-medium text-white">
              <span className="h-1.5 w-1.5 rounded-full bg-white" />
              Active
            </span>
          )}
          <Button
            size="sm"
            variant={referral.disabled ? "default" : "outline"}
            onClick={handleToggleDisabled}
            disabled={toggling}
          >
            {toggling
              ? "Saving…"
              : referral.disabled
              ? "Re-enable"
              : "Disable"}
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <InfoCard
          title="Referral Info"
          rows={[
            { label: "Referrer", value: referrerEmail },
            { label: "Referee (Email)", value: referral.referee ?? "—" },
            { label: "Date & Time", value: formatDateTime(referral.referralTime) },
          ]}
        />
        <InfoCard
          title="Status"
          rows={[
            { label: "Status", value: referral.disabled ? "Disabled" : "Active" },
            { label: "Document ID", value: referral.docId ?? "—", mono: true },
          ]}
        />
      </div>
    </div>
  );
}

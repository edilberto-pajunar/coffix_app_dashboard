"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useUserStore } from "../store/useUserStore";
import { useStoreStore } from "@/app/dashboard/stores/store/useStoreStore";
import { UserService } from "@/app/dashboard/users/service/UserService";
import { AppUser } from "../interface/user";
import { formatDate, formatDateTime } from "@/app/utils/formatting";
// ─── Formatting helpers ───────────────────────────────────────────────────────

function formatBool(value: boolean | undefined): string {
  if (value === true) return "Yes";
  if (value === false) return "No";
  return "—";
}

function firestoreTimestampToDateString(value: unknown): string {
  if (!value) return "";
  if (value instanceof Date) return value.toLocaleDateString("en-CA");
  if (typeof value === "object" && value !== null && "seconds" in value) {
    return new Date((value as { seconds: number }).seconds * 1000).toLocaleDateString("en-CA");
  }
  return "";
}

// ─── Shared display components ────────────────────────────────────────────────

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

// ─── Edit form ────────────────────────────────────────────────────────────────

type UserEditForm = {
  firstName: string;
  lastName: string;
  nickName: string;
  mobile: string;
  birthday: string;
  suburb: string;
  city: string;
  creditAvailable: string;
  creditExpiry: string;
  qrId: string;
  preferredStoreId: string;
  preferredStoreName: string;
  appVersion: string;
  getPurchaseInfoByMail: boolean;
  getPromotions: boolean;
  allowWinACoffee: boolean;
  disabled: boolean;
  emailVerified: boolean;
};

type DialogMode = "edit-user" | null;

function userToForm(user: AppUser): UserEditForm {
  return {
    firstName: user.firstName ?? "",
    lastName: user.lastName ?? "",
    nickName: user.nickName ?? "",
    mobile: user.mobile ?? "",
    birthday: firestoreTimestampToDateString(user.birthday),
    suburb: user.suburb ?? "",
    city: user.city ?? "",
    creditAvailable: (user.creditAvailable ?? 0).toString(),
    creditExpiry: firestoreTimestampToDateString(user.creditExpiry),
    qrId: user.qrId ?? "",
    preferredStoreId: user.preferredStoreId ?? "",
    preferredStoreName: user.preferredStoreName ?? "",
    appVersion: user.appVersion ?? "",
    getPurchaseInfoByMail: user.getPurchaseInfoByMail ?? false,
    getPromotions: user.getPromotions ?? false,
    allowWinACoffee: user.allowWinACoffee ?? false,
    disabled: user.disabled ?? false,
    emailVerified: user.emailVerified ?? false,
  };
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function UserDetailPage() {
  const { userId } = useParams<{ userId: string }>();
  const router = useRouter();
  const users = useUserStore((s) => s.users);
  const stores = useStoreStore((s) => s.stores);
  const user = users.find((u) => u.docId === userId);

  const [dialog, setDialog] = useState<DialogMode>(null);
  const [form, setForm] = useState<UserEditForm | null>(null);
  const [errors, setErrors] = useState<Partial<Record<keyof UserEditForm, boolean>>>({});
  const [loading, setLoading] = useState(false);

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

  // ── Handlers ──

  function openEdit() {
    setForm(userToForm(user!));
    setErrors({});
    setDialog("edit-user");
  }

  function closeDialog() {
    setDialog(null);
    setForm(null);
    setErrors({});
  }

  function setField<K extends keyof UserEditForm>(key: K, value: UserEditForm[K]) {
    setForm((f) => (f ? { ...f, [key]: value } : f));
    setErrors((e) => ({ ...e, [key]: false }));
  }

  async function handleUpdate() {
    if (!form || !user?.docId) return;

    const newErrors: Partial<Record<keyof UserEditForm, boolean>> = {};

    if (form.qrId.trim() && !/^\d{4}-\d{4}-\d{4}-\d{4}$/.test(form.qrId.trim())) {
      newErrors.qrId = true;
    }
    if (form.appVersion.trim() && !/^\d+\.\d+\.\d+\+\d+$/.test(form.appVersion.trim())) {
      newErrors.appVersion = true;
    }

    if (Object.values(newErrors).some(Boolean)) {
      setErrors(newErrors);
      return;
    }

    const birthdayDate = form.birthday ? new Date(form.birthday + "T00:00:00") : undefined;
    const creditExpiryDate = form.creditExpiry ? new Date(form.creditExpiry + "T00:00:00") : undefined;
    const creditParsed = parseFloat(form.creditAvailable);

    setLoading(true);
    try {
      await UserService.updateUser(user.docId, {
        firstName: form.firstName.trim() || undefined,
        lastName: form.lastName.trim() || undefined,
        nickName: form.nickName.trim() || undefined,
        email: user.email,
        mobile: form.mobile.trim() || undefined,
        birthday: birthdayDate,
        suburb: form.suburb.trim() || undefined,
        city: form.city.trim() || undefined,
        creditAvailable: isNaN(creditParsed) ? 0 : creditParsed,
        creditExpiry: creditExpiryDate,
        qrId: form.qrId.trim() || undefined,
        preferredStoreId: form.preferredStoreId || undefined,
        preferredStoreName: form.preferredStoreName || undefined,
        appVersion: form.appVersion.trim() || undefined,
        getPurchaseInfoByMail: form.getPurchaseInfoByMail,
        getPromotions: form.getPromotions,
        allowWinACoffee: form.allowWinACoffee,
        disabled: form.disabled,
        emailVerified: form.emailVerified,
      });
      toast.success("User updated successfully.");
      closeDialog();
    } catch (err) {
      console.error(err);
      toast.error("Failed to update user. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  // ── Render ──

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <button
            onClick={() => router.push("/dashboard/users")}
            className="mb-2 text-xs text-light-grey hover:text-black"
          >
            ← Back to Customers
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
        <button
          onClick={openEdit}
          className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-black transition-colors hover:border-primary hover:text-primary"
        >
          Edit
        </button>
      </div>

      {/* Cards */}
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

        {/* Account card — rendered manually to support the Email Verified badge */}
        <div className="overflow-hidden rounded-xl border border-border bg-white shadow-(--shadow)">
          <div className="border-b border-border px-4 py-3">
            <h2 className="font-semibold text-black">Account</h2>
          </div>
          <div className="divide-y divide-border">
            <InfoRow label="Doc ID" value={user.docId ?? "—"} mono />
            <InfoRow label="QR ID" value={user.qrId ?? "—"} mono />
            <InfoRow label="Credit Available" value={`$${(user.creditAvailable ?? 0).toFixed(2)}`} />
            <InfoRow label="Credit Expiry" value={formatDate(user.creditExpiry)} />
            <InfoRow label="Created At" value={formatDateTime(user.createdAt)} />
            <InfoRow label="Last Login" value={formatDateTime(user.lastLogin)} />
            <div className="flex items-center justify-between px-4 py-3">
              <span className="text-xs text-light-grey">Email Verified</span>
              <Button
                variant={user.emailVerified === true ? "solid-success" : "destructive"}
                size="xs"
                disabled
              >
                {user.emailVerified === true ? "Verified" : "Not Verified"}
              </Button>
            </div>
            <InfoRow label="Disabled" value={formatBool(user.disabled)} />
          </div>
        </div>

        <InfoCard
          title="Preferences"
          rows={[
            { label: "Preferred Store", value: user.preferredStoreName ?? user.preferredStoreId ?? "—" },
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
              { label: "App Version", value: user.appVersion ?? "—", mono: true },
            ]}
          />
        </div>
      </div>

      {/* Edit dialog */}
      {dialog === "edit-user" && form && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={closeDialog}
        >
          <div
            className="w-full max-w-lg rounded-2xl bg-white shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Dialog header */}
            <div className="border-b border-border px-6 py-4">
              <h3 className="text-lg font-semibold text-black">Edit Customer</h3>
            </div>

            {/* Scrollable body */}
            <div className="max-h-[72vh] space-y-4 overflow-y-auto px-6 py-4">

              {/* Text / number fields */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1.5 block text-xs text-light-grey">First Name</label>
                  <input
                    className="w-full rounded-lg border border-border px-3 py-2 text-sm text-black outline-none focus:border-primary"
                    value={form.firstName}
                    onChange={(e) => setField("firstName", e.target.value)}
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs text-light-grey">Last Name</label>
                  <input
                    className="w-full rounded-lg border border-border px-3 py-2 text-sm text-black outline-none focus:border-primary"
                    value={form.lastName}
                    onChange={(e) => setField("lastName", e.target.value)}
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs text-light-grey">Nickname</label>
                  <input
                    className="w-full rounded-lg border border-border px-3 py-2 text-sm text-black outline-none focus:border-primary"
                    value={form.nickName}
                    onChange={(e) => setField("nickName", e.target.value)}
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs text-light-grey">Mobile</label>
                  <input
                    type="tel"
                    className="w-full rounded-lg border border-border px-3 py-2 text-sm text-black outline-none focus:border-primary"
                    value={form.mobile}
                    onChange={(e) => setField("mobile", e.target.value)}
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs text-light-grey">Birthday</label>
                  <input
                    type="date"
                    className="w-full rounded-lg border border-border px-3 py-2 text-sm text-black outline-none focus:border-primary"
                    value={form.birthday}
                    onChange={(e) => setField("birthday", e.target.value)}
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs text-light-grey">Suburb</label>
                  <input
                    className="w-full rounded-lg border border-border px-3 py-2 text-sm text-black outline-none focus:border-primary"
                    value={form.suburb}
                    onChange={(e) => setField("suburb", e.target.value)}
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs text-light-grey">City</label>
                  <input
                    className="w-full rounded-lg border border-border px-3 py-2 text-sm text-black outline-none focus:border-primary"
                    value={form.city}
                    onChange={(e) => setField("city", e.target.value)}
                  />
                </div>
                <div className="col-span-2">
                  <label className="mb-1.5 block text-xs text-light-grey">Credit Available ($)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    className="w-full rounded-lg border border-border px-3 py-2 text-sm text-black outline-none focus:border-primary"
                    value={form.creditAvailable}
                    onChange={(e) => setField("creditAvailable", e.target.value)}
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs text-light-grey">Credit Expiry</label>
                  <input
                    type="date"
                    className="w-full rounded-lg border border-border px-3 py-2 text-sm text-black outline-none focus:border-primary"
                    value={form.creditExpiry}
                    onChange={(e) => setField("creditExpiry", e.target.value)}
                  />
                </div>
                <div>
                  <label className={`mb-1.5 block text-xs ${errors.qrId ? "text-red-500" : "text-light-grey"}`}>
                    QR ID {errors.qrId && <span className="text-red-500">— must be xxxx-xxxx-xxxx-xxxx (digits)</span>}
                  </label>
                  <input
                    className={`w-full rounded-lg border px-3 py-2 text-sm text-black outline-none focus:border-primary font-mono ${errors.qrId ? "border-red-400" : "border-border"}`}
                    placeholder="xxxx-xxxx-xxxx-xxxx"
                    value={form.qrId}
                    onChange={(e) => setField("qrId", e.target.value)}
                  />
                </div>
                <div>
                  <label className={`mb-1.5 block text-xs ${errors.appVersion ? "text-red-500" : "text-light-grey"}`}>
                    App Version {errors.appVersion && <span className="text-red-500">— must be x.x.x+x</span>}
                  </label>
                  <input
                    className={`w-full rounded-lg border px-3 py-2 text-sm text-black outline-none focus:border-primary font-mono ${errors.appVersion ? "border-red-400" : "border-border"}`}
                    placeholder="x.x.x+x"
                    value={form.appVersion}
                    onChange={(e) => setField("appVersion", e.target.value)}
                  />
                </div>
                <div className="col-span-2">
                  <label className="mb-1.5 block text-xs text-light-grey">Preferred Store</label>
                  <select
                    className="w-full rounded-lg border border-border px-3 py-2 text-sm text-black outline-none focus:border-primary bg-white"
                    value={form.preferredStoreId}
                    onChange={(e) => {
                      const storeId = e.target.value;
                      const store = stores.find((s) => s.docId === storeId);
                      setForm((f) => f ? { ...f, preferredStoreId: storeId, preferredStoreName: store?.name ?? "" } : f);
                      setErrors((er) => ({ ...er, preferredStoreId: false }));
                    }}
                  >
                    <option value="">None</option>
                    {stores.map((store) => (
                      <option key={store.docId} value={store.docId}>
                        {store.name ?? store.docId}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Boolean flags */}
              <div>
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-light-grey">Flags</p>
                <div className="divide-y divide-border overflow-hidden rounded-lg border border-border">
                  {(
                    [
                      { key: "getPurchaseInfoByMail", label: "Purchase Info by Mail" },
                      { key: "getPromotions", label: "Get Promotions" },
                      { key: "allowWinACoffee", label: "Allow Win a Coffee" },
                      { key: "disabled", label: "Disabled" },
                    ] as { key: keyof UserEditForm; label: string }[]
                  ).map(({ key, label }) => (
                    <label key={key} className="flex cursor-pointer items-center justify-between px-3 py-2.5 hover:bg-[#fafafa]">
                      <span className="text-sm text-black">{label}</span>
                      <input
                        type="checkbox"
                        checked={form[key] as boolean}
                        onChange={(e) => setField(key, e.target.checked)}
                        className="accent-primary"
                      />
                    </label>
                  ))}
                </div>
              </div>

              {/* Read-only fields */}
              <div>
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-light-grey">Read-only</p>
                <div className="space-y-2 rounded-lg border border-border bg-[#fafafa] px-3 py-2">
                  {[
                    { label: "Email", value: user.email ?? "—" },
                    { label: "Doc ID", value: user.docId ?? "—" },
                    { label: "FCM Token", value: user.fcmToken ?? "—" },
                    { label: "Email Verified", value: formatBool(user.emailVerified) },
                  ].map(({ label, value }) => (
                    <div key={label} className="flex items-center justify-between gap-4">
                      <span className="shrink-0 text-xs text-light-grey">{label}</span>
                      <span className="truncate font-mono text-xs text-black" title={value}>{value}</span>
                    </div>
                  ))}
                </div>
              </div>

            </div>

            {/* Dialog footer */}
            <div className="flex justify-end gap-2 border-t border-border px-6 py-4">
              <button
                onClick={closeDialog}
                className="rounded-lg border border-border px-4 py-2 text-sm text-black hover:bg-[#f0f0f0]"
              >
                Cancel
              </button>
              <button
                onClick={handleUpdate}
                disabled={loading}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:opacity-80 disabled:opacity-50"
              >
                {loading ? "Saving…" : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

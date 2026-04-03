"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Timestamp } from "firebase/firestore";
import { Plus, Pencil, Trash2, X } from "lucide-react";
import { useNotificationStore } from "./store/useNotificationStore";
import { useStoreStore } from "@/app/dashboard/stores/store/useStoreStore";
import { useStaffStore } from "@/app/dashboard/staffs/store/useStaffStore";
import { useAuth } from "@/app/lib/AuthContext";
import { NotificationService } from "./service/NotificationService";
import {
  NotificationCampaign,
  NotificationChannel,
  CampaignStatus,
  ScheduleMode,
  UserFilter,
} from "./interface/notification";

// ─── Types ────────────────────────────────────────────────────────────────────

type FilterRow = {
  field: string;
  operator: UserFilter["operator"];
  value: string;
};

type CampaignForm = {
  name: string;
  channels: NotificationChannel[];
  storeIds: string[];
  birthdayMonth: string; // "" = any, "1"–"12"
  filters: FilterRow[];
  title: string;
  body: string;
  buttonText: string;
  buttonUrl: string;
  imageUrl: string;
  subject: string;
  preheader: string;
  scheduleMode: ScheduleMode;
  sendAt: string; // datetime-local string
  recurrence: "daily" | "weekly" | "monthly" | "";
};

type FormErrors = {
  name?: boolean;
  channels?: boolean;
  title?: boolean;
  body?: boolean;
};

const emptyForm: CampaignForm = {
  name: "",
  channels: [],
  storeIds: [],
  birthdayMonth: "",
  filters: [],
  title: "",
  body: "",
  buttonText: "",
  buttonUrl: "",
  imageUrl: "",
  subject: "",
  preheader: "",
  scheduleMode: "immediate",
  sendAt: "",
  recurrence: "",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function campaignToForm(c: NotificationCampaign): CampaignForm {
  let sendAtStr = "";
  if (c.schedule.sendAt) {
    const d = c.schedule.sendAt.toDate();
    // datetime-local format: "YYYY-MM-DDTHH:mm"
    sendAtStr = d.toISOString().slice(0, 16);
  }
  return {
    name: c.name,
    channels: c.channels.filter((ch) => ch !== "sms"),
    storeIds: c.audience.storeIds ?? [],
    birthdayMonth: c.audience.birthdayMonth?.toString() ?? "",
    filters: (c.audience.filters ?? []).map((f) => ({
      field: f.field,
      operator: f.operator,
      value: String(f.value),
    })),
    title: c.template.title,
    body: c.template.body,
    buttonText: c.template.buttonText ?? "",
    buttonUrl: c.template.buttonUrl ?? "",
    imageUrl: c.template.imageUrl ?? "",
    subject: c.template.subject ?? "",
    preheader: c.template.preheader ?? "",
    scheduleMode: c.schedule.mode,
    sendAt: sendAtStr,
    recurrence: c.schedule.recurrence ?? "",
  };
}

function validateForm(form: CampaignForm): FormErrors {
  return {
    name: !form.name.trim(),
    channels: form.channels.length === 0,
    title: !form.title.trim(),
    body: !form.body.trim(),
  };
}

function hasErrors(errors: FormErrors): boolean {
  return Object.values(errors).some(Boolean);
}

function formToPayload(
  form: CampaignForm,
  status: CampaignStatus
): Omit<NotificationCampaign, "docId" | "createdBy" | "createdAt"> {
  const audience: NotificationCampaign["audience"] = {};
  if (form.storeIds.length > 0) audience.storeIds = form.storeIds;
  if (form.birthdayMonth) audience.birthdayMonth = parseInt(form.birthdayMonth);
  const validFilters = form.filters.filter(
    (f) => f.field.trim() && f.value.trim()
  );
  if (validFilters.length > 0) {
    audience.filters = validFilters.map((f) => ({
      field: f.field.trim(),
      operator: f.operator,
      value: f.value.trim(),
    }));
  }

  const template: NotificationCampaign["template"] = {
    title: form.title.trim(),
    body: form.body.trim(),
  };
  if (form.buttonText) template.buttonText = form.buttonText.trim();
  if (form.buttonUrl) template.buttonUrl = form.buttonUrl.trim();
  if (form.imageUrl) template.imageUrl = form.imageUrl.trim();
  if (form.subject) template.subject = form.subject.trim();
  if (form.preheader) template.preheader = form.preheader.trim();

  const schedule: NotificationCampaign["schedule"] = {
    mode: form.scheduleMode,
  };
  if (form.scheduleMode === "scheduled" && form.sendAt) {
    schedule.sendAt = Timestamp.fromDate(new Date(form.sendAt));
  }
  if (form.scheduleMode === "recurring" && form.recurrence) {
    schedule.recurrence = form.recurrence;
  }

  return { name: form.name.trim(), channels: form.channels, audience, template, schedule, status };
}

function formatSchedule(campaign: NotificationCampaign): string {
  const { mode, sendAt, recurrence } = campaign.schedule;
  if (mode === "immediate") return "Immediate";
  if (mode === "scheduled" && sendAt) {
    return sendAt.toDate().toLocaleString();
  }
  if (mode === "recurring" && recurrence) {
    return recurrence.charAt(0).toUpperCase() + recurrence.slice(1);
  }
  return mode;
}

const STATUS_STYLES: Record<CampaignStatus, string> = {
  draft: "bg-soft-grey text-light-grey",
  scheduled: "bg-blue-100 text-blue-700",
  sent: "bg-green-100 text-green-700",
  cancelled: "bg-red-100 text-red-600",
};

const CHANNEL_LABELS: Record<NotificationChannel, string> = {
  in_app: "In-App",
  popup: "Popup",
  email: "Email",
  sms: "SMS",
};

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const OPERATORS: UserFilter["operator"][] = [
  "==", "!=", ">=", "<=", ">", "<", "array-contains",
];

// ─── Form dialog ──────────────────────────────────────────────────────────────

function CampaignDialog({
  title,
  form,
  errors,
  loading,
  storeOptions,
  onClose,
  onSaveDraft,
  onSend,
  setForm,
}: {
  title: string;
  form: CampaignForm;
  errors: FormErrors;
  loading: boolean;
  storeOptions: { docId: string; name?: string }[];
  onClose: () => void;
  onSaveDraft: () => void;
  onSend: () => void;
  setForm: React.Dispatch<React.SetStateAction<CampaignForm>>;
}) {
  function toggleChannel(ch: NotificationChannel) {
    setForm((f) => ({
      ...f,
      channels: f.channels.includes(ch)
        ? f.channels.filter((c) => c !== ch)
        : [...f.channels, ch],
    }));
  }

  function toggleStore(id: string) {
    setForm((f) => ({
      ...f,
      storeIds: f.storeIds.includes(id)
        ? f.storeIds.filter((s) => s !== id)
        : [...f.storeIds, id],
    }));
  }

  function addFilter() {
    setForm((f) => ({
      ...f,
      filters: [...f.filters, { field: "", operator: "==", value: "" }],
    }));
  }

  function removeFilter(idx: number) {
    setForm((f) => ({
      ...f,
      filters: f.filters.filter((_, i) => i !== idx),
    }));
  }

  function setFilterField(idx: number, key: keyof FilterRow, value: string) {
    setForm((f) => ({
      ...f,
      filters: f.filters.map((row, i) =>
        i === idx ? { ...row, [key]: value } : row
      ),
    }));
  }

  const hasPopup = form.channels.includes("popup");
  const hasEmail = form.channels.includes("email");

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="flex w-full max-w-2xl flex-col rounded-2xl bg-white shadow-xl"
        style={{ maxHeight: "90vh" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <h3 className="text-lg font-semibold text-black">{title}</h3>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-light-grey transition-colors hover:bg-soft-grey"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 space-y-6 overflow-y-auto px-6 py-4">
          {/* Campaign Name */}
          <div>
            <label className="mb-1.5 block text-xs text-light-grey">
              Campaign Name *
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) =>
                setForm((f) => ({ ...f, name: e.target.value }))
              }
              placeholder="e.g. Birthday Blast – June"
              className={`w-full rounded-lg border px-3 py-2 text-sm text-black outline-none focus:border-primary ${
                errors.name ? "border-error" : "border-border"
              }`}
            />
            {errors.name && (
              <p className="mt-1 text-xs text-error">Campaign name is required.</p>
            )}
          </div>

          {/* Channels */}
          <div>
            <label className="mb-2 block text-xs text-light-grey">
              Channels * {errors.channels && (
                <span className="text-error">— select at least one</span>
              )}
            </label>
            <div className="flex flex-wrap gap-4">
              {(["in_app", "popup", "email"] as NotificationChannel[]).map((ch) => (
                <label key={ch} className="flex cursor-pointer items-center gap-2">
                  <input
                    type="checkbox"
                    checked={form.channels.includes(ch)}
                    onChange={() => toggleChannel(ch)}
                    className="accent-primary"
                  />
                  <span className="text-sm text-black">{CHANNEL_LABELS[ch]}</span>
                </label>
              ))}
              {/* SMS — placeholder, not yet available */}
              <label className="flex cursor-not-allowed items-center gap-2 opacity-50">
                <input type="checkbox" disabled className="accent-primary" />
                <span className="text-sm text-black">SMS</span>
                <span className="rounded-full bg-soft-grey px-2 py-0.5 text-xs text-light-grey">
                  Coming soon
                </span>
              </label>
            </div>
          </div>

          {/* Audience */}
          <div className="rounded-xl border border-border p-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-light-grey">
              Audience
            </p>

            {/* Store filter */}
            {storeOptions.length > 0 && (
              <div className="mb-4">
                <label className="mb-1.5 block text-xs text-light-grey">
                  Target Stores (leave empty for all)
                </label>
                <div className="flex flex-wrap gap-2">
                  {storeOptions.map((s) => (
                    <button
                      key={s.docId}
                      type="button"
                      onClick={() => toggleStore(s.docId)}
                      className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                        form.storeIds.includes(s.docId)
                          ? "border-primary bg-primary text-white"
                          : "border-border text-black hover:bg-soft-grey"
                      }`}
                    >
                      {s.name ?? s.docId}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Birthday month */}
            <div className="mb-4">
              <label className="mb-1.5 block text-xs text-light-grey">
                Birthday Month
              </label>
              <select
                value={form.birthdayMonth}
                onChange={(e) =>
                  setForm((f) => ({ ...f, birthdayMonth: e.target.value }))
                }
                className="w-full rounded-lg border border-border px-3 py-2 text-sm text-black outline-none focus:border-primary"
              >
                <option value="">Any month</option>
                {MONTH_NAMES.map((m, i) => (
                  <option key={i + 1} value={String(i + 1)}>
                    {m}
                  </option>
                ))}
              </select>
            </div>

            {/* Custom filters */}
            <div>
              <label className="mb-1.5 block text-xs text-light-grey">
                Custom User Filters
              </label>
              <div className="space-y-2">
                {form.filters.map((row, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <input
                      type="text"
                      placeholder="field (e.g. totalTopUp)"
                      value={row.field}
                      onChange={(e) =>
                        setFilterField(idx, "field", e.target.value)
                      }
                      className="flex-1 rounded-lg border border-border px-3 py-2 text-xs text-black outline-none focus:border-primary"
                    />
                    <select
                      value={row.operator}
                      onChange={(e) =>
                        setFilterField(
                          idx,
                          "operator",
                          e.target.value as UserFilter["operator"]
                        )
                      }
                      className="rounded-lg border border-border px-2 py-2 text-xs text-black outline-none focus:border-primary"
                    >
                      {OPERATORS.map((op) => (
                        <option key={op} value={op}>
                          {op}
                        </option>
                      ))}
                    </select>
                    <input
                      type="text"
                      placeholder="value"
                      value={row.value}
                      onChange={(e) =>
                        setFilterField(idx, "value", e.target.value)
                      }
                      className="flex-1 rounded-lg border border-border px-3 py-2 text-xs text-black outline-none focus:border-primary"
                    />
                    <button
                      type="button"
                      onClick={() => removeFilter(idx)}
                      className="rounded-lg p-1.5 text-light-grey transition-colors hover:bg-soft-grey"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={addFilter}
                className="mt-2 text-xs text-primary underline-offset-2 hover:underline"
              >
                + Add filter
              </button>
            </div>
          </div>

          {/* Message / Template */}
          <div className="rounded-xl border border-border p-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-light-grey">
              Message
            </p>

            {hasEmail && (
              <>
                <div className="mb-3">
                  <label className="mb-1.5 block text-xs text-light-grey">
                    Subject (Email)
                  </label>
                  <input
                    type="text"
                    value={form.subject}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, subject: e.target.value }))
                    }
                    placeholder="Happy Birthday, {{firstName}}!"
                    className="w-full rounded-lg border border-border px-3 py-2 text-sm text-black outline-none focus:border-primary"
                  />
                </div>
                <div className="mb-3">
                  <label className="mb-1.5 block text-xs text-light-grey">
                    Preheader (Email)
                  </label>
                  <input
                    type="text"
                    value={form.preheader}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, preheader: e.target.value }))
                    }
                    placeholder="Short preview shown in inbox…"
                    className="w-full rounded-lg border border-border px-3 py-2 text-sm text-black outline-none focus:border-primary"
                  />
                </div>
              </>
            )}

            <div className="mb-3">
              <label className="mb-1.5 block text-xs text-light-grey">
                Title *
              </label>
              <input
                type="text"
                value={form.title}
                onChange={(e) =>
                  setForm((f) => ({ ...f, title: e.target.value }))
                }
                placeholder="Happy Birthday, {{firstName}}! 🎂"
                className={`w-full rounded-lg border px-3 py-2 text-sm text-black outline-none focus:border-primary ${
                  errors.title ? "border-error" : "border-border"
                }`}
              />
              {errors.title && (
                <p className="mt-1 text-xs text-error">Title is required.</p>
              )}
            </div>

            <div className="mb-3">
              <label className="mb-1.5 block text-xs text-light-grey">
                Body *
              </label>
              <textarea
                rows={3}
                value={form.body}
                onChange={(e) =>
                  setForm((f) => ({ ...f, body: e.target.value }))
                }
                placeholder="Your gift is waiting — redeem {{credits}} credits at {{storeName}}."
                className={`w-full rounded-lg border px-3 py-2 text-sm text-black outline-none focus:border-primary ${
                  errors.body ? "border-error" : "border-border"
                }`}
              />
              {errors.body && (
                <p className="mt-1 text-xs text-error">Body is required.</p>
              )}
            </div>

            {hasPopup && (
              <>
                <div className="mb-3">
                  <label className="mb-1.5 block text-xs text-light-grey">
                    Button Text (Popup)
                  </label>
                  <input
                    type="text"
                    value={form.buttonText}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, buttonText: e.target.value }))
                    }
                    placeholder="Claim Now"
                    className="w-full rounded-lg border border-border px-3 py-2 text-sm text-black outline-none focus:border-primary"
                  />
                </div>
                <div className="mb-3">
                  <label className="mb-1.5 block text-xs text-light-grey">
                    Button URL (Popup)
                  </label>
                  <input
                    type="text"
                    value={form.buttonUrl}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, buttonUrl: e.target.value }))
                    }
                    placeholder="{{appUrl}}"
                    className="w-full rounded-lg border border-border px-3 py-2 text-sm text-black outline-none focus:border-primary"
                  />
                </div>
              </>
            )}

            {(hasPopup || hasEmail) && (
              <div>
                <label className="mb-1.5 block text-xs text-light-grey">
                  Image URL {hasPopup && hasEmail ? "(Popup / Email)" : hasPopup ? "(Popup)" : "(Email)"}
                </label>
                <input
                  type="text"
                  value={form.imageUrl}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, imageUrl: e.target.value }))
                  }
                  placeholder="https://..."
                  className="w-full rounded-lg border border-border px-3 py-2 text-sm text-black outline-none focus:border-primary"
                />
              </div>
            )}
          </div>

          {/* Schedule */}
          <div className="rounded-xl border border-border p-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-light-grey">
              Schedule
            </p>
            <div className="flex flex-wrap gap-4">
              {(["immediate", "scheduled", "recurring"] as ScheduleMode[]).map(
                (mode) => (
                  <label
                    key={mode}
                    className="flex cursor-pointer items-center gap-2"
                  >
                    <input
                      type="radio"
                      name="scheduleMode"
                      value={mode}
                      checked={form.scheduleMode === mode}
                      onChange={() =>
                        setForm((f) => ({ ...f, scheduleMode: mode }))
                      }
                      className="accent-primary"
                    />
                    <span className="text-sm text-black capitalize">{mode}</span>
                  </label>
                )
              )}
            </div>

            {form.scheduleMode === "scheduled" && (
              <div className="mt-3">
                <label className="mb-1.5 block text-xs text-light-grey">
                  Send At
                </label>
                <input
                  type="datetime-local"
                  value={form.sendAt}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, sendAt: e.target.value }))
                  }
                  className="rounded-lg border border-border px-3 py-2 text-sm text-black outline-none focus:border-primary"
                />
              </div>
            )}

            {form.scheduleMode === "recurring" && (
              <div className="mt-3">
                <label className="mb-1.5 block text-xs text-light-grey">
                  Recurrence
                </label>
                <select
                  value={form.recurrence}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      recurrence: e.target.value as CampaignForm["recurrence"],
                    }))
                  }
                  className="rounded-lg border border-border px-3 py-2 text-sm text-black outline-none focus:border-primary"
                >
                  <option value="">Select…</option>
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 border-t border-border px-6 py-4">
          <button
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm text-black transition-colors hover:bg-soft-grey"
          >
            Cancel
          </button>
          <button
            onClick={onSaveDraft}
            disabled={loading}
            className="rounded-lg border border-border px-4 py-2 text-sm text-black transition-colors hover:bg-soft-grey disabled:opacity-50"
          >
            Save as Draft
          </button>
          <button
            onClick={onSend}
            disabled={loading}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-80 disabled:opacity-50"
          >
            {loading ? "Saving…" : "Send / Schedule"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function NotificationsPage() {
  const campaigns = useNotificationStore((s) => s.campaigns);
  const stores = useStoreStore((s) => s.stores);
  const staffs = useStaffStore((s) => s.staffs);
  const { user } = useAuth();

  const currentStaff = staffs.find((s) => s.docId === user?.uid);
  const isAdmin = currentStaff?.role === "admin";

  const [showCreate, setShowCreate] = useState(false);
  const [editTarget, setEditTarget] = useState<NotificationCampaign | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<NotificationCampaign | null>(null);
  const [form, setForm] = useState<CampaignForm>(emptyForm);
  const [errors, setErrors] = useState<FormErrors>({});
  const [loading, setLoading] = useState(false);

  function openCreate() {
    setForm(emptyForm);
    setErrors({});
    setShowCreate(true);
  }

  function openEdit(c: NotificationCampaign) {
    setForm(campaignToForm(c));
    setErrors({});
    setEditTarget(c);
  }

  function closeDialog() {
    setShowCreate(false);
    setEditTarget(null);
    setErrors({});
  }

  async function handleSave(status: CampaignStatus) {
    const errs = validateForm(form);
    if (hasErrors(errs)) {
      setErrors(errs);
      toast.error("Please fix the highlighted fields.");
      return;
    }
    if (!user) return;

    setLoading(true);
    try {
      const payload = formToPayload(form, status);
      if (editTarget) {
        await NotificationService.updateCampaign(editTarget.docId, payload);
        toast.success("Campaign updated.");
      } else {
        await NotificationService.createCampaign(
          payload as Omit<NotificationCampaign, "docId">,
          user.uid
        );
        toast.success(
          status === "draft" ? "Saved as draft." : "Campaign scheduled."
        );
      }
      closeDialog();
    } catch (err) {
      console.error(err);
      toast.error("Failed to save campaign.");
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setLoading(true);
    try {
      await NotificationService.deleteCampaign(deleteTarget.docId);
      toast.success("Campaign deleted.");
      setDeleteTarget(null);
    } catch (err) {
      console.error(err);
      toast.error("Failed to delete campaign.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-black">Notifications</h1>
          <p className="mt-1 text-sm text-light-grey">
            Compose and dispatch campaigns to app users.
          </p>
        </div>
        {isAdmin && (
          <button
            onClick={openCreate}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-80"
          >
            <Plus size={15} />
            New Campaign
          </button>
        )}
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border bg-white shadow-(--shadow)">
        {campaigns.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-light-grey">
            <p className="text-sm">No campaigns yet.</p>
            {isAdmin && (
              <button
                onClick={openCreate}
                className="mt-3 text-sm text-primary underline-offset-2 hover:underline"
              >
                Create your first campaign
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-light-grey">
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">Channels</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Schedule</th>
                  {isAdmin && (
                    <th className="px-4 py-3 font-medium">Actions</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {campaigns.map((c) => (
                  <tr
                    key={c.docId}
                    className="border-b border-border last:border-0 hover:bg-soft-grey/40"
                  >
                    <td className="px-4 py-3 font-medium text-black">
                      {c.name}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {c.channels?.length > 0 ? c.channels.map((ch) => (
                          <span
                            key={ch}
                            className="rounded-full bg-soft-grey px-2 py-0.5 text-xs text-black"
                          >
                            {CHANNEL_LABELS[ch]}
                          </span>
                        )) : "All"}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_STYLES[c.status]}`}
                      >
                        {c.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-light-grey">
                      {formatSchedule(c)}
                    </td>
                    {isAdmin && (
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => openEdit(c)}
                            className="rounded-lg p-1.5 text-light-grey transition-colors hover:bg-soft-grey"
                            title="Edit"
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            onClick={() => setDeleteTarget(c)}
                            className="rounded-lg p-1.5 text-light-grey transition-colors hover:bg-red-50 hover:text-red-500"
                            title="Delete"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create / Edit dialog */}
      {(showCreate || editTarget) && (
        <CampaignDialog
          title={editTarget ? "Edit Campaign" : "New Campaign"}
          form={form}
          errors={errors}
          loading={loading}
          storeOptions={stores}
          onClose={closeDialog}
          onSaveDraft={() => handleSave("draft")}
          onSend={() =>
            handleSave(
              form.scheduleMode === "immediate" ? "sent" : "scheduled"
            )
          }
          setForm={setForm}
        />
      )}

      {/* Delete confirmation dialog */}
      {deleteTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setDeleteTarget(null)}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-black">Delete Campaign</h3>
            <p className="mt-2 text-sm text-light-grey">
              Are you sure you want to delete{" "}
              <span className="font-medium text-black">{deleteTarget.name}</span>?
              This cannot be undone.
            </p>
            <div className="mt-5 flex justify-end gap-3">
              <button
                onClick={() => setDeleteTarget(null)}
                className="rounded-lg px-4 py-2 text-sm text-black transition-colors hover:bg-soft-grey"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={loading}
                className="rounded-lg bg-red-500 px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-80 disabled:opacity-50"
              >
                {loading ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

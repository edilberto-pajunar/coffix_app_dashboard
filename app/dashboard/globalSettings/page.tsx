"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useGlobalSettingsStore } from "./store/useGlobalSettingsStore";
import { GlobalSettingsService } from "./service/GlobalSettingsService";
import { GlobalSettings } from "./interface/global_settings";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

// ─── Validation ───────────────────────────────────────────────────────────────

const SEMVER_RE = /^\d+\.\d+\.\d+(\+\d+)?$/; // Accepts x.x.x.+x
const HTTPS_URL_RE = /^https:\/\/.+/;

type FormState = {
  GST: string;
  appVersion: string;
  basicDiscount: string;
  discountLevel2: string;
  discountLevel3: string;
  maxDayBetweenLogin: string;
  minCreditToShare: string;
  minTopUp: string;
  specialUrl: string;
  storeUrl: string;
  tcUrl: string;
  topupLevel2: string;
  topupLevel3: string;
  withdrawalFee: string;
};

function settingsToForm(s: GlobalSettings): FormState {
  return {
    GST: s.GST?.toString() ?? "",
    appVersion: s.appVersion ?? "",
    basicDiscount: s.basicDiscount?.toString() ?? "",
    discountLevel2: s.discountLevel2?.toString() ?? "",
    discountLevel3: s.discountLevel3?.toString() ?? "",
    maxDayBetweenLogin: s.maxDayBetweenLogin?.toString() ?? "",
    minCreditToShare: s.minCreditToShare?.toString() ?? "",
    minTopUp: s.minTopUp?.toString() ?? "",
    specialUrl: s.specialUrl ?? "",
    storeUrl: s.storeUrl ?? "",
    tcUrl: s.tcUrl ?? "",
    topupLevel2: s.topupLevel2?.toString() ?? "",
    topupLevel3: s.topupLevel3?.toString() ?? "",
    withdrawalFee: s.withdrawalFee?.toString() ?? "",
  };
}

const NUMERIC_NON_NEGATIVE: (keyof FormState)[] = [
  "GST",
  "basicDiscount",
  "discountLevel2",
  "discountLevel3",
  "maxDayBetweenLogin",
  "topupLevel2",
  "topupLevel3",
  "withdrawalFee",
];
const NUMERIC_POSITIVE: (keyof FormState)[] = ["minCreditToShare", "minTopUp"];
const URL_FIELDS: (keyof FormState)[] = ["specialUrl", "storeUrl", "tcUrl"];

const FIELD_LABELS: Record<keyof FormState, string> = {
  GST: "GST",
  appVersion: "App Version",
  basicDiscount: "Basic Discount",
  discountLevel2: "Discount Level 2",
  discountLevel3: "Discount Level 3",
  maxDayBetweenLogin: "Max Days Between Login",
  minCreditToShare: "Min Credit to Share",
  minTopUp: "Min Top Up",
  specialUrl: "Special URL",
  storeUrl: "Store URL",
  tcUrl: "T&C URL",
  topupLevel2: "Top Up Level 2",
  topupLevel3: "Top Up Level 3",
  withdrawalFee: "Withdrawal Fee",
};

function validateForm(form: FormState): string[] {
  const errors: string[] = [];

  for (const field of NUMERIC_NON_NEGATIVE) {
    const v = form[field];
    if (v === "") continue;
    const n = Number(v);
    if (isNaN(n) || n < 0) {
      errors.push(`${FIELD_LABELS[field]}: must be a non-negative number`);
    }
  }

  for (const field of NUMERIC_POSITIVE) {
    const v = form[field];
    if (v === "") continue;
    const n = Number(v);
    if (isNaN(n) || n <= 0) {
      errors.push(`${FIELD_LABELS[field]}: must be greater than 0`);
    }
  }

  if (form.appVersion && !SEMVER_RE.test(form.appVersion)) {
    errors.push("App Version: must follow semver format (e.g. 1.0.0)");
  }

  for (const field of URL_FIELDS) {
    const v = form[field];
    if (v && !HTTPS_URL_RE.test(v)) {
      errors.push(`${FIELD_LABELS[field]}: must be a valid HTTPS URL`);
    }
  }

  return errors;
}

function formToPayload(form: FormState): Partial<GlobalSettings> {
  const payload: Partial<GlobalSettings> = {};
  const numericFields = [
    ...NUMERIC_NON_NEGATIVE,
    ...NUMERIC_POSITIVE,
  ] as (keyof FormState)[];

  for (const field of numericFields) {
    const v = form[field];
    if (v !== "") (payload as Record<string, unknown>)[field] = Number(v);
  }

  if (form.appVersion) payload.appVersion = form.appVersion;
  for (const field of URL_FIELDS) {
    if (form[field])
      (payload as Record<string, unknown>)[field] = form[field];
  }

  return payload;
}

// ─── Field component ──────────────────────────────────────────────────────────

function Field({
  label,
  type,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  type: "number" | "text";
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-xs text-light-grey">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-border px-3 py-2 text-sm text-black outline-none focus:border-primary"
      />
    </div>
  );
}

// ─── Section wrapper ──────────────────────────────────────────────────────────

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border bg-white p-5 shadow-(--shadow)">
      <h2 className="mb-4 text-sm font-semibold text-black">{title}</h2>
      <div className="space-y-4">{children}</div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const emptyForm: FormState = {
  GST: "",
  appVersion: "",
  basicDiscount: "",
  discountLevel2: "",
  discountLevel3: "",
  maxDayBetweenLogin: "",
  minCreditToShare: "",
  minTopUp: "",
  specialUrl: "",
  storeUrl: "",
  tcUrl: "",
  topupLevel2: "",
  topupLevel3: "",
  withdrawalFee: "",
};

export default function GlobalSettingsPage() {
  const settings = useGlobalSettingsStore((s) => s.settings);

  const [form, setForm] = useState<FormState>(emptyForm);
  const [loading, setLoading] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  useEffect(() => {
    if (settings) {
      setForm(settingsToForm(settings));
    }
  }, [settings]);

  function setField(field: keyof FormState) {
    return (v: string) => setForm((f) => ({ ...f, [field]: v }));
  }

  async function handleSave() {
    const errors = validateForm(form);
    if (errors.length > 0) {
      setValidationErrors(errors);
      return;
    }

    setLoading(true);
    try {
      await GlobalSettingsService.updateSettings(formToPayload(form));
      toast.success("Settings saved.");
    } catch (err) {
      console.error(err);
      toast.error("Failed to save settings.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-black">Global Settings</h1>
          <p className="mt-1 text-sm text-light-grey">
            App-wide variables — changes propagate to the mobile app
            immediately.
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={loading}
          className="w-full rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-80 disabled:opacity-50 sm:w-auto"
        >
          {loading ? "Saving…" : "Save"}
        </button>
      </div>

      {/* Sections grid */}
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <Section title="Tax & Fees">
          <Field
            label="GST"
            type="number"
            value={form.GST}
            onChange={setField("GST")}
            placeholder="0.09"
          />
          <Field
            label="Withdrawal Fee"
            type="number"
            value={form.withdrawalFee}
            onChange={setField("withdrawalFee")}
            placeholder="0"
          />
        </Section>

        <Section title="Loyalty Discounts">
          <Field
            label="Basic Discount (Level 1)"
            type="number"
            value={form.basicDiscount}
            onChange={setField("basicDiscount")}
            placeholder="0.05"
          />
          <Field
            label="Discount Level 2"
            type="number"
            value={form.discountLevel2}
            onChange={setField("discountLevel2")}
            placeholder="0.10"
          />
          <Field
            label="Discount Level 3"
            type="number"
            value={form.discountLevel3}
            onChange={setField("discountLevel3")}
            placeholder="0.15"
          />
        </Section>

        <Section title="Loyalty Thresholds">
        <Field
            label="Top Up Level 1"
            type="number"
            value={form.minTopUp}
            onChange={setField("minTopUp")}
            placeholder="10"
          />
          <Field
            label="Top Up Level 2"
            type="number"
            value={form.topupLevel2}
            onChange={setField("topupLevel2")}
            placeholder="100"
          />
          <Field
            label="Top Up Level 3"
            type="number"
            value={form.topupLevel3}
            onChange={setField("topupLevel3")}
            placeholder="300"
          />
        </Section>

        <Section title="Account Rules">
          <Field
            label="Max Days Between Login"
            type="number"
            value={form.maxDayBetweenLogin}
            onChange={setField("maxDayBetweenLogin")}
            placeholder="90"
          />
          <Field
            label="Min Credit to Share"
            type="number"
            value={form.minCreditToShare}
            onChange={setField("minCreditToShare")}
            placeholder="10"
          />
          {/* <Field
            label="Min Top Up"
            type="number"
            value={form.minTopUp}
            onChange={setField("minTopUp")}
            placeholder="10"
          /> */}
        </Section>

        <Section title="App Config">
          <Field
            label="App Version"
            type="text"
            value={form.appVersion}
            onChange={setField("appVersion")}
            placeholder="1.0.0"
          />
        </Section>

        <Section title="URLs">
          <Field
            label="Special URL"
            type="text"
            value={form.specialUrl}
            onChange={setField("specialUrl")}
            placeholder="https://..."
          />
          <Field
            label="Store URL"
            type="text"
            value={form.storeUrl}
            onChange={setField("storeUrl")}
            placeholder="https://..."
          />
          <Field
            label="T&C URL"
            type="text"
            value={form.tcUrl}
            onChange={setField("tcUrl")}
            placeholder="https://..."
          />
        </Section>
      </div>

      {/* Validation error dialog */}
      <Dialog
        open={validationErrors.length > 0}
        onOpenChange={(open) => {
          if (!open) setValidationErrors([]);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Fix validation errors</DialogTitle>
            <DialogDescription>
              Please correct the following before saving:
            </DialogDescription>
          </DialogHeader>
          <ul className="space-y-1.5 text-sm text-black">
            {validationErrors.map((e, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="mt-0.5 text-error">•</span>
                <span>{e}</span>
              </li>
            ))}
          </ul>
          <DialogFooter showCloseButton />
        </DialogContent>
      </Dialog>
    </div>
  );
}

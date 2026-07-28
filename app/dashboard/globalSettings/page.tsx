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
import { Button } from "@/components/ui/button";
import { useActivityLog } from "../logs/hooks/useActivityLog";
import { LOG_CATEGORY, LOG_PAGE, LOG_SEVERITY } from "../logs/constants/logConstants";

// ─── Validation ───────────────────────────────────────────────────────────────

const SEMVER_RE = /^\d+\.\d+\.\d+(\+\d+)?$/; // Accepts x.x.x.+x
const HTTPS_URL_RE = /^https:\/\/.+/;

type FormState = {
  GST: string;
  appVersion: string;
  basicDiscount: string;
  couponDefaultAmount: string;
  couponExpiryDays: string;
  creditExpiryDuration: string;
  discountLevel2: string;
  discountLevel3: string;
  maxDayBetweenLogin: string;
  minCreditToShare: string;
  minTopUp: string;
  referralExpiryDays: string;
  aboutUrl: string;
  specialUrl: string;
  storeUrl: string;
  tcUrl: string;
  topupLevel1: string;
  topupLevel2: string;
  topupLevel3: string;
  withdrawalFee: string;
};

function settingsToForm(s: GlobalSettings): FormState {
  return {
    GST: s.GST?.toString() ?? "",
    appVersion: s.appVersion ?? "",
    basicDiscount: s.basicDiscount?.toString() ?? "",
    couponDefaultAmount: s.couponDefaultAmount?.toString() ?? "",
    couponExpiryDays: s.couponExpiryDays?.toString() ?? "",
    creditExpiryDuration: s.creditExpiryDuration?.toString() ?? "",
    discountLevel2: s.discountLevel2?.toString() ?? "",
    discountLevel3: s.discountLevel3?.toString() ?? "",
    maxDayBetweenLogin: s.maxDayBetweenLogin?.toString() ?? "",
    minCreditToShare: s.minCreditToShare?.toString() ?? "",
    minTopUp: s.minTopUp?.toString() ?? "",
    referralExpiryDays: s.referralExpiryDays?.toString() ?? "",
    aboutUrl: s.aboutUrl ?? "",
    specialUrl: s.specialUrl ?? "",
    storeUrl: s.storeUrl ?? "",
    tcUrl: s.tcUrl ?? "",
    topupLevel1: s.topupLevel1?.toString() ?? "",
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
  "topupLevel1",
  "topupLevel2",
  "topupLevel3",
  "withdrawalFee",
];
const NUMERIC_INTEGER: (keyof FormState)[] = ["creditExpiryDuration", "referralExpiryDays", "couponExpiryDays"];
const NUMERIC_POSITIVE: (keyof FormState)[] = ["minCreditToShare", "minTopUp", "couponDefaultAmount"];
const URL_FIELDS: (keyof FormState)[] = ["aboutUrl", "specialUrl", "storeUrl", "tcUrl"];

const FIELD_LABELS: Record<keyof FormState, string> = {
  GST: "GST",
  appVersion: "Minimum App Version",
  basicDiscount: "Basic Discount",
  couponDefaultAmount: "Coupon Default Amount",
  couponExpiryDays: "Coupon Expiry Days",
  creditExpiryDuration: "Credit Expiry Duration",
  discountLevel2: "Discount Level 2",
  discountLevel3: "Discount Level 3",
  maxDayBetweenLogin: "Max Days Between Login",
  minCreditToShare: "Min Credit to Share",
  minTopUp: "Min Top Up",
  referralExpiryDays: "Referral Expiry Days",
  aboutUrl: "About URL",
  specialUrl: "Special URL",
  storeUrl: "Store URL",
  tcUrl: "T&C URL",
  topupLevel1: "Top Up Level 1",
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
    errors.push("Minimum App Version: must follow semver format (e.g. 1.0.0)");
  }

  for (const field of NUMERIC_INTEGER) {
    const v = form[field];
    if (v === "") continue;
    const n = Number(v);
    if (isNaN(n) || n < 0 || !Number.isInteger(n)) {
      errors.push(`${FIELD_LABELS[field]}: must be a non-negative whole number (days)`);
    }
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

  if (form.creditExpiryDuration !== "")
    payload.creditExpiryDuration = parseInt(form.creditExpiryDuration, 10);
  if (form.referralExpiryDays !== "")
    payload.referralExpiryDays = parseInt(form.referralExpiryDays, 10);
  if (form.couponExpiryDays !== "")
    payload.couponExpiryDays = parseInt(form.couponExpiryDays, 10);

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
  prefix,
  suffix,
  money,
}: {
  label: string;
  type: "number" | "text";
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  prefix?: string;
  suffix?: string;
  money?: boolean;
}) {
  const paddingLeft = prefix ? "pl-7" : "px-3";
  const paddingRight = suffix ? "pr-12" : "px-3";
  const padding = prefix ? `${paddingLeft} pr-3` : suffix ? `pl-3 ${paddingRight}` : "px-3";

  const displayValue =
    money && value !== "" && !isNaN(Number(value))
      ? Number(value).toFixed(2)
      : value;

  return (
    <div>
      <label className="mb-1.5 block text-xs text-light-grey">{label}</label>
      <div className="relative">
        {prefix && (
          <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-light-grey">
            {prefix}
          </span>
        )}
        <input
          type={type}
          value={displayValue}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={`w-full rounded-lg border border-border ${padding} py-2 text-sm text-black outline-none focus:border-primary`}
        />
        {suffix && (
          <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-light-grey">
            {suffix}
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Toggle field ─────────────────────────────────────────────────────────────

function ToggleField({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <p className="text-sm font-medium text-black">{label}</p>
        <p className="text-xs text-light-grey">{description}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none ${
          checked ? "bg-primary" : "bg-border"
        }`}
      >
        <span
          className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow ring-0 transition-transform ${
            checked ? "translate-x-5" : "translate-x-0"
          }`}
        />
      </button>
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
  couponDefaultAmount: "",
  couponExpiryDays: "",
  creditExpiryDuration: "",
  discountLevel2: "",
  discountLevel3: "",
  maxDayBetweenLogin: "",
  minCreditToShare: "",
  minTopUp: "",
  referralExpiryDays: "",
  aboutUrl: "",
  specialUrl: "",
  storeUrl: "",
  tcUrl: "",
  topupLevel1: "",
  topupLevel2: "",
  topupLevel3: "",
  withdrawalFee: "",
};

type FlagsState = {
  defScheduleOrder: boolean;
  defShareCredit: boolean;
  defWithdrawBalance: boolean;
  defCoffixCreditAvailable: boolean;
  defGetPurchaseInfoByMail: boolean;
  defGetPromotions: boolean;
  defAllowWinACoffee: boolean;
  defAllowCoffeeForHome: boolean;
  defAllowNotifications: boolean;
};

const emptyFlags: FlagsState = {
  defScheduleOrder: false,
  defShareCredit: false,
  defWithdrawBalance: false,
  defCoffixCreditAvailable: false,
  defGetPurchaseInfoByMail: false,
  defGetPromotions: false,
  defAllowWinACoffee: false,
  defAllowCoffeeForHome: false,
  defAllowNotifications: false,
};

const FLAG_META: { key: keyof FlagsState; label: string; description: string }[] = [
  { key: "defScheduleOrder", label: "Schedule Order", description: "Allow users to schedule orders by default" },
  { key: "defShareCredit", label: "Share Credit", description: "Allow users to share credits by default" },
  { key: "defWithdrawBalance", label: "Withdraw Balance", description: "Allow users to withdraw balance by default" },
  { key: "defCoffixCreditAvailable", label: "Coffix Credit Available", description: "Enable Coffix credit for new users by default" },
  { key: "defGetPurchaseInfoByMail", label: "Get Purchase Info by Mail", description: "Send purchase receipts by email by default" },
  { key: "defGetPromotions", label: "Get Promotions", description: "Subscribe to promotions by default" },
  { key: "defAllowWinACoffee", label: "Allow Win a Coffee", description: "Enable \"Win a Coffee\" feature by default" },
  { key: "defAllowCoffeeForHome", label: "Allow Coffee for Home", description: "Enable \"Coffee for Home\" feature by default" },
  { key: "defAllowNotifications", label: "Allow Notifications", description: "Enable push notifications for new users by default" },
];

export default function GlobalSettingsPage() {
  const settings = useGlobalSettingsStore((s) => s.settings);

  const [form, setForm] = useState<FormState>(emptyForm);
  const [flags, setFlags] = useState<FlagsState>(emptyFlags);
  const [loading, setLoading] = useState(false);
  const { log } = useActivityLog();
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  useEffect(() => {
    if (settings) {
      setForm(settingsToForm(settings));
      setFlags({
        defScheduleOrder: settings.defScheduleOrder ?? false,
        defShareCredit: settings.defShareCredit ?? false,
        defWithdrawBalance: settings.defWithdrawBalance ?? false,
        defCoffixCreditAvailable: settings.defCoffixCreditAvailable ?? false,
        defGetPurchaseInfoByMail: settings.defGetPurchaseInfoByMail ?? false,
        defGetPromotions: settings.defGetPromotions ?? false,
        defAllowWinACoffee: settings.defAllowWinACoffee ?? false,
        defAllowCoffeeForHome: settings.defAllowCoffeeForHome ?? false,
        defAllowNotifications: settings.defAllowNotifications ?? false,
      });
    }
  }, [settings]);

  function setField(field: keyof FormState) {
    return (v: string) => setForm((f) => ({ ...f, [field]: v }));
  }

  function setFlag(key: keyof FlagsState) {
    return (v: boolean) => setFlags((f) => ({ ...f, [key]: v }));
  }

  async function handleSave() {
    const errors = validateForm(form);
    if (errors.length > 0) {
      setValidationErrors(errors);
      return;
    }

    setLoading(true);
    try {
      await GlobalSettingsService.updateSettings({ ...formToPayload(form), ...flags });
      log({
        category: LOG_CATEGORY.GLOBAL_SETTINGS,
        severityLevel: LOG_SEVERITY.HIGH,
        action: "Save Global Settings",
        notes: "Admin changed app-wide settings (fees, discounts, top-up tiers, etc.)",
        page: LOG_PAGE.GLOBAL_SETTINGS,
      });
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
        <Button
          onClick={handleSave}
          disabled={loading}
        >
          {loading ? "Saving…" : "Save"}
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <Section title="Tax & Fees">
          <Field
            label="GST"
            type="number"
            value={form.GST}
            onChange={setField("GST")}
            placeholder="0.09"
            suffix="%"
          />
          <Field
            label="Withdrawal Fee"
            type="number"
            value={form.withdrawalFee}
            onChange={setField("withdrawalFee")}
            placeholder="0.00"
            prefix="$"
            money
          />
        </Section>

        <Section title="Coffix Credit Discount">
          <Field
            label="Basic Discount (Level 1)"
            type="number"
            value={form.basicDiscount}
            onChange={setField("basicDiscount")}
            placeholder="0.05"
            suffix="%"
          />
          <Field
            label="Discount Level 2"
            type="number"
            value={form.discountLevel2}
            onChange={setField("discountLevel2")}
            placeholder="0.10"
            suffix="%"
          />
          <Field
            label="Discount Level 3"
            type="number"
            value={form.discountLevel3}
            onChange={setField("discountLevel3")}
            placeholder="0.15"
            suffix="%"
          />
        </Section>

        <Section title="Coffix Credit TopUp Amount">
          <Field
            label="Min Top Up"
            type="number"
            value={form.minTopUp}
            onChange={setField("minTopUp")}
            placeholder="0.00"
            prefix="$"
            money
          />
          <Field
            label="Top Up Level 1"
            type="number"
            value={form.topupLevel1}
            onChange={setField("topupLevel1")}
            placeholder="0.00"
            prefix="$"
            money
          />
          <Field
            label="Top Up Level 2"
            type="number"
            value={form.topupLevel2}
            onChange={setField("topupLevel2")}
            placeholder="0.00"
            prefix="$"
            money
          />
          <Field
            label="Top Up Level 3"
            type="number"
            value={form.topupLevel3}
            onChange={setField("topupLevel3")}
            placeholder="0.00"
            prefix="$"
            money
          />
        </Section>

        <Section title="Account Rules">
          <Field
            label="Max Days Between Login"
            type="number"
            value={form.maxDayBetweenLogin}
            onChange={setField("maxDayBetweenLogin")}
            placeholder="90"
            suffix="days"
          />
          <Field
            label="Min Credit to Share"
            type="number"
            value={form.minCreditToShare}
            onChange={setField("minCreditToShare")}
            placeholder="10"
            prefix="$"
            suffix="credits"
          />
          <Field
            label="Credit Expiry Duration"
            type="number"
            value={form.creditExpiryDuration}
            onChange={setField("creditExpiryDuration")}
            placeholder="30"
            suffix="days"
          />
          {/* <Field
            label="Min Top Up"
            type="number"
            value={form.minTopUp}
            onChange={setField("minTopUp")}
            placeholder="10"
          /> */}
        </Section>

        <Section title="Referral & Coupons">
          <Field
            label="Referral Expiry Days"
            type="number"
            value={form.referralExpiryDays}
            onChange={setField("referralExpiryDays")}
            placeholder="30"
            suffix="days"
          />
          <Field
            label="Coupon Default Amount"
            type="number"
            value={form.couponDefaultAmount}
            onChange={setField("couponDefaultAmount")}
            placeholder="0.00"
            prefix="$"
            money
          />
          <Field
            label="Coupon Expiry Days"
            type="number"
            value={form.couponExpiryDays}
            onChange={setField("couponExpiryDays")}
            placeholder="30"
            suffix="days"
          />
        </Section>

        <Section title="App Config">
          <Field
            label="Minimum App Version"
            type="text"
            value={form.appVersion}
            onChange={setField("appVersion")}
            placeholder="1.0.0"
          />
        </Section>

        <Section title="Default User Flags">
          {FLAG_META.map(({ key, label, description }) => (
            <ToggleField
              key={key}
              label={label}
              description={description}
              checked={flags[key]}
              onChange={setFlag(key)}
            />
          ))}
        </Section>

        <Section title="URLs">
          <Field
            label="About URL"
            type="text"
            value={form.aboutUrl}
            onChange={setField("aboutUrl")}
            placeholder="https://..."
          />
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
        <DialogContent className="max-w-sm">
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

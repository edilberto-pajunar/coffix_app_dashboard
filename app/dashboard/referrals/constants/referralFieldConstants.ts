export const REFERRAL_PROTECTED_FIELDS = [
  "docId",
  "referralTime",
  "referrer",
  "referee",
] as const;

export const REFERRAL_IMPORTABLE_FIELDS = ["disabled"] as const;

export const REFERRAL_EXPORTABLE_FIELDS = [
  "referralTime",
  "referrer",
  "referee",
  "disabled",
] as const;

export const REFERRAL_REQUIRED_FIELDS: string[] = [];

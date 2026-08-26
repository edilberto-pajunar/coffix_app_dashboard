export const COUPON_PROTECTED_FIELDS = [
  // "docId",
  "createdAt",
] as const;

export const COUPON_IMPORTABLE_FIELDS = [
  "type",
  "amount",
  "expiryDate",
  "storeId",
  "notes",
  "customerEmail",
] as const;

export const COUPON_EXPORTABLE_FIELDS = [
  "type",
  "amount",
  "expiryDate",
  "storeId",
  "notes",
  "customerEmail",
  "createdAt",
] as const;

export const COUPON_REQUIRED_FIELDS = [] as const;

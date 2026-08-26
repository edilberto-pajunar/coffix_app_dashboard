export const STAFF_PROTECTED_FIELDS = ["docId", "email", "createdAt"] as const;

export const STAFF_IMPORTABLE_FIELDS = [
  "role",
  "storeIds",
  "disabled",
  "firstName",
  "lastName",
] as const;

export const STAFF_EXPORTABLE_FIELDS = [
  "email",
  "createdAt",
  "role",
  "storeIds",
  "disabled",
  "firstName",
  "lastName",
] as const;

export const STAFF_REQUIRED_FIELDS: string[] = [];

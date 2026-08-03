export const CATEGORY_PROTECTED_FIELDS = [
  "docId",
  "createdAt",
  "updatedAt",
  "isDeleted",
  "deletedAt",
] as const;

export const CATEGORY_IMPORTABLE_FIELDS = ["name", "order"] as const;

export const CATEGORY_EXPORTABLE_FIELDS = [
  "docId",
  "name",
  "order",
  "imageUrl",
  "createdAt",
  "updatedAt",
  "isDeleted",
  "deletedAt",
] as const;

export const CATEGORY_REQUIRED_FIELDS = ["name"] as const;

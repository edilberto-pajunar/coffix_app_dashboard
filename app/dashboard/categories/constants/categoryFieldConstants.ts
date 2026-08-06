export const CATEGORY_PROTECTED_FIELDS = [
  "docId",
  "createdAt",
  "updatedAt",
  "isDeleted",
  "deletedAt",
] as const;

export const CATEGORY_IMPORTABLE_FIELDS = ["name", "order"] as const;

// isDeleted/deletedAt are deliberately absent: exports carry only live records, so the
// columns would be constant-valued, and the importer rejects them as protected fields.
export const CATEGORY_EXPORTABLE_FIELDS = [
  "docId",
  "name",
  "order",
  "imageUrl",
  "createdAt",
  "updatedAt",
] as const;

export const CATEGORY_REQUIRED_FIELDS = ["name"] as const;

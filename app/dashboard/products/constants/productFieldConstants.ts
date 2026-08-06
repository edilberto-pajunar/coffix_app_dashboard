export const PRODUCT_PROTECTED_FIELDS = [
  "docId",
  "createdAt",
  "updatedAt",
  "isDeleted",
  "deletedAt",
] as const;

export const PRODUCT_IMPORTABLE_FIELDS = [
  "name",
  "price",
  "cost",
  "categoryId",
  "modifierGroupIds",
  "availableToStores",
  "disabledStores",
  "imageUrl",
  "order",
] as const;

// isDeleted/deletedAt are deliberately absent: exports carry only live records, so the
// columns would be constant-valued, and the importer rejects them as protected fields.
export const PRODUCT_EXPORTABLE_FIELDS = [
  "docId",
  "name",
  "price",
  "cost",
  "categoryId",
  "modifierGroupIds",
  "availableToStores",
  "disabledStores",
  "imageUrl",
  "order",
  "createdAt",
  "updatedAt",
] as const;

export const PRODUCT_REQUIRED_FIELDS = ["name"] as const;

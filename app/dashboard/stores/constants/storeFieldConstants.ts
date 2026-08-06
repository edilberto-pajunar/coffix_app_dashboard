export const STORE_PROTECTED_FIELDS = [
  "docId",
  "createdAt",
  "updatedAt",
  "isDeleted",
  "deletedAt",
] as const;

export const STORE_IMPORTABLE_FIELDS = [
  "name",
  "address",
  "email",
  "contactNumber",
  "location",
  "imageUrl",
  "gstNumber",
  "invoiceText",
  "storeCode",
  "printerId",
  "disable",
] as const;

// isDeleted/deletedAt are deliberately absent: exports carry only live records, so the
// columns would be constant-valued, and the importer rejects them as protected fields.
export const STORE_EXPORTABLE_FIELDS = [
  "docId",
  "name",
  "address",
  "email",
  "contactNumber",
  "location",
  "imageUrl",
  "gstNumber",
  "invoiceText",
  "storeCode",
  "printerId",
  "disable",
  "city",
  "openingHours",
  "holidayHours",
  "createdAt",
  "updatedAt",
] as const;

// Required only when creating a new store from a CSV row (blank docId). These
// mirror the fields the Create Store dialog enforces, minus the optional city.
export const STORE_REQUIRED_FIELDS = [
  "name",
  "email",
  "contactNumber",
  "address",
  "printerId",
  "gstNumber",
  "invoiceText",
  "storeCode",
] as const;

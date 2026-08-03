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
  "isDeleted",
  "deletedAt",
] as const;

export const STORE_REQUIRED_FIELDS = ["name"] as const;

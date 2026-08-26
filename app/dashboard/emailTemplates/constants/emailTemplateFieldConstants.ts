export const EMAIL_TEMPLATE_PROTECTED_FIELDS = [
  "docId",
  "updatedAt",
  "updatedBy",
  "createdAt",
] as const;

export const EMAIL_TEMPLATE_IMPORTABLE_FIELDS: string[] = [];

export const EMAIL_TEMPLATE_EXPORTABLE_FIELDS = [
  "name",
  "subject",
  "notes",
  "updatedAt",
  "content",
  "updatedBy",
  "createdAt",
] as const;

export const EMAIL_TEMPLATE_REQUIRED_FIELDS: string[] = [];

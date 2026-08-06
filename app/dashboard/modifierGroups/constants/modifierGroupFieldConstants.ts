export const MODIFIER_GROUP_PROTECTED_FIELDS = [
  "docId",
  "createdAt",
  "updatedAt",
  "isDeleted",
  "deletedAt",
] as const;

// modifierIds is deliberately excluded: modifiers are attached and detached via
// ProductService.addModifierToGroup / removeModifierFromGroup, and letting a CSV
// overwrite the array wholesale would orphan modifier documents.
export const MODIFIER_GROUP_IMPORTABLE_FIELDS = ["name", "order"] as const;

export const MODIFIER_GROUP_REQUIRED_FIELDS = ["name"] as const;

// isDeleted/deletedAt are deliberately absent: exports carry only live records, so the
// columns would be constant-valued, and the importer rejects them as protected fields.
export const MODIFIER_GROUP_EXPORTABLE_FIELDS = [
  "docId",
  "name",
  "modifierIds",
  "order",
  "createdAt",
  "updatedAt",
] as const;

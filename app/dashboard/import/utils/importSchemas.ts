/**
 * Canonical import schemas — the single source of truth for bulk import/export.
 *
 * Both the client-side CSV parser (`csvParser.ts`) and the template generator
 * (`templateGenerator.ts`) derive their behaviour from this file. The Firebase
 * Functions backend that actually performs the import/export is expected to
 * validate against the same definitions.
 *
 * For each field:
 *   - `required`  the field must be present and non-empty (validation error otherwise).
 *   - `type`      how the value is parsed/validated. Untyped fields are treated as strings.
 *   - `default`   the write-time default. Applied by the backend, NOT the client parser.
 *   - `system`    identity/managed field (e.g. `id`) — never validated as user data.
 *
 * Dotted keys (e.g. "openingHours.monday.open", "card.cardNumber", "template.body")
 * are expanded into nested objects by the parser.
 */

export type FieldType =
  | "string"
  | "number"
  | "boolean"
  | "email"
  | "timestamp"
  | "array";

export interface FieldSpec {
  required?: boolean;
  type?: FieldType;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  default?: any | (() => any);
  system?: boolean;
}

export interface CollectionSchema {
  fields: Record<string, FieldSpec>;
}

export const importSchemas = {
  modifierGroups: {
    fields: {
      id: { required: false, system: true },
      modifier: { required: false, type: "string" },
      modifierCount: { required: false, type: "array" },
      modifierIds: { required: false, type: "array" },
      name: { required: true, type: "string" },
    },
  },
  modifiers: {
    fields: {
      id: { required: false, system: true },
      cost: { required: false, type: "number" },
      groupId: { required: true, type: "string" },
      isDefault: { required: false, type: "boolean", default: false },
      label: { required: true, type: "string" },
      modifierCode: { required: false, type: "string" },
      priceDelta: { required: false, type: "number" },
    },
  },
  productCategories: {
    fields: {
      id: { required: false, system: true },
      imageUrl: { required: false, type: "string" },
      name: { required: true, type: "string" },
      order: { required: false, type: "number" },
    },
  },
  products: {
    fields: {
      id: { required: false, system: true },
      availableToStores: { required: false, type: "array" },
      categoryId: { required: true, type: "string" },
      cost: { required: false, type: "number", default: 0 },
      createdAt: { default: () => new Date() },
      disabled: { required: false, type: "boolean", default: false },
      disabledPermanently: { required: false, type: "boolean", default: false },
      disabledStores: { required: false, type: "array" },
      imageUrl: { required: false, type: "string" },
      modifierGroupIds: { required: false, type: "array" },
      name: { required: true, type: "string" },
      order: { required: false, type: "number" },
      price: { required: true, type: "number" },
      updatedAt: { default: () => new Date() },
    },
  },
  stores: {
    fields: {
      id: { required: false, system: true },
      address: { required: true, type: "string" },
      city: { required: true, type: "string" },
      contactName: { required: false, type: "string" },
      disable: { required: false, type: "boolean", default: false },
      email: { required: false, type: "email" },
      gstNumber: { required: false, type: "string" },
      holidayHours: { required: false, type: "array" },
      imageUrl: { required: false, type: "string" },
      invoiceText: { required: false, type: "string" },
      location: { required: false, type: "string" },
      name: { required: true, type: "string" },
      "openingHours.monday.close": { required: false, type: "string" },
      "openingHours.monday.isOpen": { required: false, type: "boolean", default: true },
      "openingHours.monday.open": { required: false, type: "string" },
      "openingHours.tuesday.close": { required: false, type: "string" },
      "openingHours.tuesday.isOpen": { required: false, type: "boolean", default: true },
      "openingHours.tuesday.open": { required: false, type: "string" },
      "openingHours.wednesday.close": { required: false, type: "string" },
      "openingHours.wednesday.isOpen": { required: false, type: "boolean", default: true },
      "openingHours.wednesday.open": { required: false, type: "string" },
      "openingHours.thursday.close": { required: false, type: "string" },
      "openingHours.thursday.isOpen": { required: false, type: "boolean", default: true },
      "openingHours.thursday.open": { required: false, type: "string" },
      "openingHours.friday.close": { required: false, type: "string" },
      "openingHours.friday.isOpen": { required: false, type: "boolean", default: true },
      "openingHours.friday.open": { required: false, type: "string" },
      "openingHours.saturday.close": { required: false, type: "string" },
      "openingHours.saturday.isOpen": { required: false, type: "boolean", default: true },
      "openingHours.saturday.open": { required: false, type: "string" },
      "openingHours.sunday.close": { required: false, type: "string" },
      "openingHours.sunday.isOpen": { required: false, type: "boolean", default: true },
      "openingHours.sunday.open": { required: false, type: "string" },
      printerId: { required: false, type: "string" },
      storeCode: { required: false, type: "string" },
      updatedAt: { default: () => new Date() },
    },
  },
} satisfies Record<string, CollectionSchema>;

export type CollectionKey = keyof typeof importSchemas;

export const COLLECTION_KEYS = Object.keys(importSchemas) as CollectionKey[];

/**
 * Widened view of the schemas for generic (runtime, key-agnostic) access.
 * The `satisfies` above preserves each collection's literal shape for editor
 * hints, but generic code needs a plain `Record<string, FieldSpec>`.
 */
export const schemas: Record<CollectionKey, CollectionSchema> = importSchemas;

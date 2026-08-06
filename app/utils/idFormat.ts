import { ID_PREFIXES, SEQUENTIAL_ID_PADDING } from "./constant";

export type IdCollection = keyof typeof ID_PREFIXES;

// Human-readable section names, used in import error messages so a wrong-entity docId
// can name the section the file actually belongs to.
const COLLECTION_LABELS: Record<IdCollection, string> = {
  products: "Products",
  productCategories: "Categories",
  modifierGroups: "Modifier Groups",
  modifiers: "Modifiers",
  stores: "Stores",
  coupons: "Coupons",
  emails: "Email Templates",
};

export function labelForCollection(collection: IdCollection): string {
  return COLLECTION_LABELS[collection];
}

/** The example ID shown to a user fixing a malformed cell, e.g. "CAT-000001". */
export function exampleDocId(collection: IdCollection): string {
  return `${ID_PREFIXES[collection]}-${"0".repeat(SEQUENTIAL_ID_PADDING - 1)}1`;
}

/**
 * Splits "CAT-000001" into its prefix and numeric parts. Matching on the whole token
 * before the first hyphen matters: MODGRP-000001 also starts with "MOD", so a
 * `startsWith` check would read a modifier group as a modifier.
 */
function parseDocId(docId: string): { prefix: string; digits: string } | null {
  const match = /^([A-Z]+)-(\d+)$/.exec(docId.trim());
  return match ? { prefix: match[1], digits: match[2] } : null;
}

/** True when `docId` is a well-formed sequential ID for `collection`. */
export function isValidDocId(docId: string, collection: IdCollection): boolean {
  const parsed = parseDocId(docId);
  return (
    parsed !== null &&
    parsed.prefix === ID_PREFIXES[collection] &&
    parsed.digits.length === SEQUENTIAL_ID_PADDING
  );
}

/**
 * The collection whose prefix `docId` carries, or undefined when the ID is malformed or
 * uses an unknown prefix. Lets an importer say "that's a Products ID" rather than the
 * generic "no such record".
 */
export function collectionForDocId(docId: string): IdCollection | undefined {
  const parsed = parseDocId(docId);
  if (!parsed) return undefined;
  return (Object.keys(ID_PREFIXES) as IdCollection[]).find(
    (key) => ID_PREFIXES[key] === parsed.prefix,
  );
}

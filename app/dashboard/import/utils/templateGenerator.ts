import { schemas, CollectionKey, COLLECTION_KEYS } from "./importSchemas";
import { escapeCSV, formatArrayCell } from "@/app/utils/csvUtils";

/** Human-friendly labels; falls back to a title-cased key for anything not listed. */
const LABEL_OVERRIDES: Partial<Record<CollectionKey, string>> = {
  productCategories: "Categories",
  modifierGroups: "Modifier Groups",
};

function titleCase(key: string): string {
  const spaced = key.replace(/([a-z])([A-Z])/g, "$1 $2");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

export const COLLECTION_LABELS = Object.fromEntries(
  COLLECTION_KEYS.map((key) => [key, LABEL_OVERRIDES[key] ?? titleCase(key)]),
) as Record<CollectionKey, string>;

/** Column headers for a collection: docId first, then every non-system field. */
export function templateHeaders(collection: CollectionKey): string[] {
  const fields = schemas[collection].fields;
  const keys = Object.keys(fields).filter((k) => !fields[k].system);
  return ["docId", ...keys];
}

/**
 * A single example row. Array columns show an empty JSON array so the expected
 * format (`["id1","id2"]`) is discoverable when the template is opened in Excel;
 * every other column is left blank.
 */
function templateExampleRow(collection: CollectionKey, headers: string[]): string {
  const fields = schemas[collection].fields;
  return headers
    .map((h) => (fields[h]?.type === "array" ? escapeCSV(formatArrayCell([])) : ""))
    .join(",");
}

export function generateTemplate(collection: CollectionKey): void {
  const headers = templateHeaders(collection);
  const csv = [headers.join(","), templateExampleRow(collection, headers)].join("\n") + "\n";
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${collection}-template.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

import Papa from "papaparse";
import { schemas, CollectionKey, FieldSpec } from "./importSchemas";
import { parseArrayCell } from "@/app/utils/csvUtils";
import {
  exampleDocId,
  isValidDocId,
  labelForCollection,
} from "@/app/utils/idFormat";
import { ID_PREFIXES, SEQUENTIAL_ID_PADDING } from "@/app/utils/constant";

export type { CollectionKey } from "./importSchemas";

export interface RowError {
  row: number;
  message: string;
}

/**
 * An already-stored record to check the file's unique fields against. Only `docId` is read
 * by name; unique fields are looked up dynamically. Callers pass live
 * Product/Store/Category/... objects, which are plain interfaces with no index signature,
 * so this stays structural rather than requiring one.
 */
export interface ExistingRecord {
  docId?: string;
}

/** Where a value already in use came from — an existing record, or an earlier CSV row. */
type UniqueOwner = { docId?: string; row?: number };

/** Unique matching ignores case and surrounding whitespace, as the dashboard forms do. */
function normalizeKey(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

/** Read a dynamically-named field off a record whose type has no index signature. */
function fieldValue(record: ExistingRecord, field: string): unknown {
  return (record as Record<string, unknown>)[field];
}

export interface ParseResult<T> {
  creates: T[];
  updates: T[];
  errors: RowError[];
  fileError?: string;
  /** Columns present in the CSV that are not in the schema and were dropped. */
  droppedColumns: string[];
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function parseBool(val: string): boolean | null {
  const v = val.trim().toLowerCase();
  if (v === "true") return true;
  if (v === "false") return false;
  return null;
}

function parseDate(val: string): Date | null {
  const d = new Date(val.trim());
  return isNaN(d.getTime()) ? null : d;
}

/** Assign a value into a nested object following a dotted path ("a.b.c"). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function setNested(target: Record<string, any>, path: string, value: any): void {
  const parts = path.split(".");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let node: Record<string, any> = target;
  for (let i = 0; i < parts.length - 1; i++) {
    const key = parts[i];
    if (typeof node[key] !== "object" || node[key] === null) {
      node[key] = {};
    }
    node = node[key];
  }
  node[parts[parts.length - 1]] = value;
}

/**
 * Coerce/validate a single non-empty value against its field spec.
 * Returns either the coerced value or an error message.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function coerce(key: string, val: string, spec: FieldSpec): { value: any } | { error: string } {
  switch (spec.type) {
    case "number": {
      const n = parseFloat(val);
      if (isNaN(n)) return { error: `"${key}" must be a number (got "${val}")` };
      return { value: n };
    }
    case "boolean": {
      const b = parseBool(val);
      if (b === null) return { error: `"${key}" must be true or false (got "${val}")` };
      return { value: b };
    }
    case "timestamp": {
      const d = parseDate(val);
      if (!d) return { error: `"${key}" must be an ISO 8601 date (got "${val}")` };
      return { value: d };
    }
    case "email": {
      if (!EMAIL_RE.test(val.trim())) return { error: `"${key}" must be a valid email (got "${val}")` };
      return { value: val.trim() };
    }
    case "array": {
      return { value: parseArrayCell(val) };
    }
    case "string":
    default:
      return { value: val };
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function parseCSV<T extends Record<string, any>>(
  csvText: string,
  collection: CollectionKey,
  existing: readonly ExistingRecord[] = [],
): ParseResult<T> {
  const result = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: true,
  });

  if (!result.data.length) {
    return {
      creates: [],
      updates: [],
      errors: [],
      droppedColumns: [],
      fileError: "CSV file is empty or has no data rows.",
    };
  }

  const fields = schemas[collection].fields;
  const headers = Object.keys(result.data[0]);

  // Any header that is neither docId nor a known field is dropped.
  const droppedColumns = headers.filter(
    (h) => h !== "docId" && !(h in fields),
  );

  const creates: T[] = [];
  const updates: T[] = [];
  const errors: RowError[] = [];

  // unique field -> normalized value -> who holds it. Seeded from the stored records so a
  // clash with the database and a clash with an earlier row are the same lookup.
  const uniqueFields = schemas[collection].unique ?? [];
  const taken = new Map<string, Map<string, UniqueOwner>>();
  for (const field of uniqueFields) {
    const byValue = new Map<string, UniqueOwner>();
    for (const record of existing) {
      const key = normalizeKey(fieldValue(record, field));
      // Blank values are not a claim on the field — two stores without a printerId
      // must not read as duplicates of each other.
      if (!key || byValue.has(key)) continue;
      byValue.set(key, { docId: record.docId });
    }
    taken.set(field, byValue);
  }

  result.data.forEach((rawRow, idx) => {
    const rowNum = idx + 2; // 1-based, +1 for header
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const row: Record<string, any> = {};
    const rowErrors: string[] = [];

    // Validate required fields even when the column is absent from the CSV.
    for (const [key, spec] of Object.entries(fields)) {
      if (!spec.required || spec.system) continue;
      const raw = rawRow[key];
      if (!raw || !raw.trim()) {
        rowErrors.push(`"${key}" is required`);
      }
    }

    for (const [key, raw] of Object.entries(rawRow)) {
      if (key === "docId") continue; // handled as identity below
      const spec = fields[key];
      if (!spec || spec.system) continue; // unknown or system column → drop

      const val = raw?.trim() ?? "";
      if (!val) continue; // required-emptiness already reported above

      const res = coerce(key, val, spec);
      if ("error" in res) {
        rowErrors.push(res.error);
        continue;
      }
      setNested(row, key, res.value);
    }

    const docId = rawRow["docId"]?.trim() ?? "";

    // Runs before the early-return below so a row with both a bad number and a duplicate
    // name reports the two together instead of hiding one behind the other.
    for (const field of uniqueFields) {
      const byValue = taken.get(field)!;
      const value = rawRow[field]?.trim() ?? "";
      const key = normalizeKey(value);
      if (!key) continue;

      const owner = byValue.get(key);
      // An update row matching its own stored record is not a collision — the same job
      // `excludeDocId` does in the dashboard's is*NameTaken predicates.
      if (owner && !(docId && owner.docId === docId)) {
        rowErrors.push(
          owner.row != null
            ? `"${field}" must be unique — "${value}" is already used on row ${owner.row}`
            : `"${field}" must be unique — "${value}" already exists`,
        );
        continue;
      }
      // Claimed only when it was free, so the first row to use a value keeps it and each
      // later duplicate is reported against that first row.
      if (!owner) byValue.set(key, { row: rowNum, docId: docId || undefined });
    }

    if (rowErrors.length) {
      errors.push({ row: rowNum, message: rowErrors.join("; ") });
      return;
    }

    if (docId) {
      // Catches a file uploaded under the wrong collection before it reaches the
      // backend, which would otherwise be the first thing to notice. This page renders
      // the message as bare text with no explainer, so the format goes in the string.
      if (!isValidDocId(docId, collection)) {
        errors.push({
          row: rowNum,
          message: `docId "${docId}" is not a valid ${labelForCollection(collection)} ID — expected format ${exampleDocId(collection)} (${ID_PREFIXES[collection]}- followed by ${SEQUENTIAL_ID_PADDING} digits). Leave docId blank to create a new record.`,
        });
        return;
      }
      updates.push({ ...row, docId } as unknown as T);
    } else {
      creates.push(row as unknown as T);
    }
  });

  return { creates, updates, errors, droppedColumns };
}

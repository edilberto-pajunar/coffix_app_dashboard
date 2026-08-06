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

    if (rowErrors.length) {
      errors.push({ row: rowNum, message: rowErrors.join("; ") });
      return;
    }

    const docId = rawRow["docId"]?.trim() ?? "";
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

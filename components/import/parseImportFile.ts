import { parseCSVText } from "@/app/utils/csvUtils";
import type {
  ImportAction,
  ImportError,
  ImportPreview,
  ImportRow,
} from "./types";

/**
 * Columns every export emits and every import must tolerate. `docId` selects the
 * upsert target — present means update that document, absent means create a new
 * one. The timestamps and soft-delete flags are owned by the services, so they
 * are read from a CSV without complaint but never written back.
 */
export const SYSTEM_IMPORT_FIELDS = [
  "docId",
  "createdAt",
  "updatedAt",
  "isDeleted",
  "deletedAt",
] as const;

export type ValidateRow = (
  row: Record<string, string>,
  rowNum: number,
) => ImportError[];

export type ParseImportOptions = {
  /** Columns that must never appear in an uploaded file — their presence rejects it outright. */
  protectedFields: readonly string[];
  /** Columns the importer will act on. Anything else is silently ignored. */
  importableFields: readonly string[];
  /** Per-entity rules. Returning any error marks the row "error" and excludes it from the write. */
  validateRow: ValidateRow;
  /** Defaults to the upsert convention: a docId means update, its absence means create. */
  resolveAction?: (row: Record<string, string>) => ImportAction;
};

/** A whole-file rejection, distinct from the per-row errors carried in ImportPreview. */
export type ParseImportResult = ImportPreview | { fileError: string };

export function isFileError(
  result: ParseImportResult,
): result is { fileError: string } {
  return "fileError" in result;
}

function readAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (ev) => resolve((ev.target?.result as string) ?? "");
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

/**
 * Parses an uploaded CSV into a preview: every row tagged create-or-update, plus
 * the errors that kept rows out. Shared by the products, categories, stores and
 * modifier-group import flows, which differ only in `validateRow`.
 */
export async function parseImportFile(
  file: File,
  options: ParseImportOptions,
): Promise<ParseImportResult> {
  const {
    protectedFields,
    validateRow,
    resolveAction = (row) => (row.docId ? "update" : "create"),
  } = options;

  let text: string;
  try {
    text = await readAsText(file);
  } catch {
    return { fileError: "Failed to read CSV file." };
  }

  let headers: string[];
  let rawRows: string[][];
  try {
    ({ headers, rows: rawRows } = parseCSVText(text));
  } catch {
    return { fileError: "Failed to read CSV file." };
  }

  if (headers.length === 0 || rawRows.length === 0) {
    return { fileError: "CSV file is empty or has no data rows." };
  }

  // System columns are exempt: every export emits them, so rejecting them would
  // break the export → edit → import round-trip. Anything else on the protected
  // list still rejects the file outright.
  const systemFields = SYSTEM_IMPORT_FIELDS as readonly string[];
  const protectedInFile = headers.filter(
    (h) => protectedFields.includes(h) && !systemFields.includes(h),
  );
  if (protectedInFile.length > 0) {
    return {
      fileError: `CSV contains protected columns: ${protectedInFile.join(
        ", ",
      )}. Remove them and re-upload.`,
    };
  }

  const rows: ImportRow[] = [];
  const errors: ImportError[] = [];

  rawRows.forEach((cols, idx) => {
    const rowNum = idx + 2;
    const row: Record<string, string> = {};
    headers.forEach((h, i) => {
      row[h] = cols[i] ?? "";
    });

    // Failed rows stay in `rows` so the preview can show them alongside the good
    // ones, tagged "error". Callers must skip them when writing.
    const rowErrors = validateRow(row, rowNum);
    if (rowErrors.length > 0) {
      errors.push(...rowErrors);
      rows.push({ rowNum, action: "error", data: row, errors: rowErrors });
      return;
    }

    rows.push({ rowNum, action: resolveAction(row), data: row });
  });

  return { rows, errors };
}

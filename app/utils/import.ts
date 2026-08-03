import {
  escapeCSV,
  formatArrayCell,
  triggerCSVDownload,
  tsToISO,
} from "./csvUtils";

function isTimestampLike(value: unknown): value is { seconds: number } {
  return typeof value === "object" && value !== null && "seconds" in value;
}

export function exportRowsToCSV<T extends object>(
  items: T[],
  fields: readonly string[],
  filenamePrefix: string,
  filename?: string,
): void {
  const rows = items.map((item) =>
    fields
      .map((field) => {
        const value = (item as Record<string, unknown>)[field];
        if (Array.isArray(value)) return escapeCSV(formatArrayCell(value));
        if (value instanceof Date || isTimestampLike(value)) {
          return escapeCSV(tsToISO(value));
        }
        if (typeof value === "object" && value !== null) {
          return escapeCSV(JSON.stringify(value));
        }
        if (typeof value === "boolean") return String(value);
        return escapeCSV(String(value ?? ""));
      })
      .join(","),
  );
  triggerCSVDownload(
    [fields.join(","), ...rows].join("\n"),
    filename ??
      `${filenamePrefix}-${new Date().toISOString().slice(0, 10)}.csv`,
  );
}

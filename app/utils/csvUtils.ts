export function escapeCSV(v: string): string {
  return `"${String(v).replace(/"/g, '""')}"`;
}

/** Serialize an array field as a JSON literal for a CSV cell. */
export function formatArrayCell(value: unknown): string {
  const arr = Array.isArray(value)
    ? value.filter((v) => v !== null && v !== undefined)
    : [];
  return JSON.stringify(arr);
}

/** Parse an array cell: JSON first, pipe-delimited as a legacy fallback. */
export function parseArrayCell(raw: string): string[] {
  const t = (raw ?? "").trim();
  if (!t) return [];
  if (t.startsWith("[")) {
    try {
      const parsed = JSON.parse(t);
      if (Array.isArray(parsed)) {
        return parsed.map((v) => String(v).trim()).filter(Boolean);
      }
    } catch {
      // Not valid JSON — fall through to the legacy pipe format.
    }
  }
  return t
    .split("|")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function parseCSVLine(line: string): string[] {
  return (
    line
      .match(/("(?:[^"]|"")*"|[^,]*)/g)
      ?.map((c) => c.replace(/^"|"$/g, "").replace(/""/g, '"')) ?? []
  );
}

export function parseCSVText(text: string): {
  headers: string[];
  rows: string[][];
} {
  const lines = text.split("\n").filter((l) => l.trim());
  if (lines.length === 0) return { headers: [], rows: [] };
  const headers = parseCSVLine(lines[0]);
  const rows = lines.slice(1).map((l) => parseCSVLine(l));
  return { headers, rows };
}

export function buildCSVString(headers: string[], rows: string[][]): string {
  const headerLine = headers.join(",");
  const dataLines = rows.map((r) => r.join(","));
  return [headerLine, ...dataLines].join("\n");
}

export function triggerCSVDownload(csvString: string, filename: string): void {
  const blob = new Blob([csvString], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function tsToISO(value: unknown): string {
  if (!value) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "object" && value !== null && "seconds" in value) {
    return new Date((value as { seconds: number }).seconds * 1000)
      .toISOString()
      .slice(0, 10);
  }
  return "";
}

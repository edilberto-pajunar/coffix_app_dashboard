import { CollectionKey } from "../utils/importSchemas";

export interface ImportError {
  docId?: string;
  row?: number;
  message: string;
}

export interface ImportResult {
  created: number;
  updated: number;
  errors: ImportError[];
}

function triggerDownload(
  content: BlobPart,
  filename: string,
  mime: string,
): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Ask the backend to export a collection and download the returned CSV.
 * Handles both a raw `text/csv` response and a JSON envelope (`{ csv }` / `{ data }`).
 */
export async function exportCollection(
  collection: CollectionKey,
): Promise<void> {
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_BACKEND_URL}/import/export`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ collection }),
      cache: "no-store",
    },
  );

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `Export failed (${res.status})`);
  }

  const contentType = res.headers.get("content-type") ?? "";
  const filename = `${collection}-export-${new Date().toISOString().slice(0, 10)}.csv`;

  if (contentType.includes("application/json")) {
    const json = await res.json();
    const csv = typeof json === "string" ? json : (json.csv ?? json.data ?? "");
    if (!csv) throw new Error("Export response contained no CSV data.");
    triggerDownload(csv, filename, "text/csv");
    return;
  }

  const csv = await res.text();
  triggerDownload(csv, filename, "text/csv");
}

/**
 * Send the original CSV file to the backend for import. The backend performs
 * the authoritative validation and Firestore writes and returns a summary.
 */
export async function importCollection(
  collection: CollectionKey,
  file: File,
): Promise<ImportResult> {
  const form = new FormData();
  form.append("collection", collection);
  form.append("file", file);

  const res = await fetch(
    `${process.env.NEXT_PUBLIC_BACKEND_URL}/import/import`,
    {
      method: "POST",
      body: form,
      cache: "no-store",
    },
  );

  const json = await res.json().catch(() => null);

  if (!res.ok) {
    const message =
      (json && (json.error || json.message)) || `Import failed (${res.status})`;
    throw new Error(message);
  }

  return {
    created: json?.created ?? 0,
    updated: json?.updated ?? 0,
    errors: Array.isArray(json?.errors) ? json.errors : [],
  };
}

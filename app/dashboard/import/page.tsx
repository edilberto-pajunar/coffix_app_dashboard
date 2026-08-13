"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Upload, Download, Upload as UploadIcon, FileText, AlertCircle, CheckCircle2, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { parseCSV, ExistingRecord, RowError } from "./utils/csvParser";
import { CollectionKey, COLLECTION_KEYS } from "./utils/importSchemas";
import { useDashboardStore } from "@/app/dashboard/products/store/useDashboardStore";
import { useStoreStore } from "@/app/dashboard/stores/store/useStoreStore";
import { generateTemplate, COLLECTION_LABELS } from "./utils/templateGenerator";
import { exportCollection, importCollection, ImportError } from "./service/BackendImportService";

const COLLECTIONS: CollectionKey[] = COLLECTION_KEYS;

interface ImportSummary {
  received: number;
  created: number;
  updated: number;
  skipped: number;
  errors: ImportError[];
}

export default function ImportPage() {
  const [collection, setCollection] = useState<CollectionKey>(COLLECTIONS[0]);
  const [fileError, setFileError] = useState<string | null>(null);
  const [previewPage, setPreviewPage] = useState(0);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [creates, setCreates] = useState<Record<string, any>[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [updates, setUpdates] = useState<Record<string, any>[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [rowErrors, setRowErrors] = useState<RowError[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  const products = useDashboardStore((s) => s.products);
  const categories = useDashboardStore((s) => s.categories);
  const modifiers = useDashboardStore((s) => s.modifiers);
  const modifierGroups = useDashboardStore((s) => s.modifierGroups);
  const stores = useStoreStore((s) => s.stores);

  // The unique-field check needs the records already in Firestore. Stores listens too
  // because listenToAll reads the live store IDs from it when normalizing products.
  useEffect(() => {
    const unsubStores = useStoreStore.getState().listenToStores();
    const unsubDashboard = useDashboardStore.getState().listenToAll();
    return () => {
      unsubStores();
      unsubDashboard();
    };
  }, []);

  /** Live (non-soft-deleted) records for the selected collection. */
  function existingFor(col: CollectionKey): ExistingRecord[] {
    switch (col) {
      case "products":
        return products;
      case "productCategories":
        return categories;
      case "modifiers":
        return modifiers;
      case "modifierGroups":
        return modifierGroups;
      case "stores":
        return stores;
    }
  }

  function resetFile() {
    setFileError(null);
    setPreviewPage(0);
    setCreates([]);
    setUpdates([]);
    setRowErrors([]);
    setFile(null);
    setFileName(null);
    setSummary(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  function handleCollectionChange(col: CollectionKey) {
    setCollection(col);
    resetFile();
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0];
    if (!selected) return;
    setSummary(null);
    setFile(selected);
    setFileName(selected.name);

    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const result = parseCSV(text, collection, existingFor(collection));
      setRowErrors(result.errors);

      if (result.fileError) {
        setFileError(result.fileError);
        setPreviewPage(0);
        setCreates([]);
        setUpdates([]);
        return;
      }

      if (result.creates.length === 0 && result.updates.length === 0) {
        // With per-row errors to show, the wrong-collection advice would be a red herring —
        // the listed reasons say exactly why each row was rejected.
        setFileError(
          result.errors.length
            ? `No valid rows found for "${COLLECTION_LABELS[collection]}". Every row was rejected — see the errors below.`
            : `No valid rows found for "${COLLECTION_LABELS[collection]}". Check that you selected the right collection and that the CSV columns match its template.`,
        );
        setCreates([]);
        setUpdates([]);
        setPreviewPage(0);
        return;
      }

      setFileError(null);
      setCreates(result.creates);
      setUpdates(result.updates);
      setPreviewPage(0);
    };
    reader.readAsText(selected);
  }

  async function handleImport() {
    if (!file || (!creates.length && !updates.length)) return;
    setImporting(true);
    try {
      const result = await importCollection(collection, file);
      setSummary(result);
      if (result.errors.length === 0) {
        toast.success(`Import complete: ${result.created} created, ${result.updated} updated.`);
      } else {
        toast.warning(`Import done with ${result.errors.length} error(s). See summary below.`);
      }
      resetFile();
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "Import failed. Check the console for details.");
    } finally {
      setImporting(false);
    }
  }

  async function handleExport() {
    setExporting(true);
    try {
      await exportCollection(collection);
      toast.success(`Exported ${COLLECTION_LABELS[collection]}.`);
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "Export failed. Check the console for details.");
    } finally {
      setExporting(false);
    }
  }

  const hasData = creates.length > 0 || updates.length > 0;
  const canImport = hasData && !fileError && !!file;

  const PREVIEW_PAGE_SIZE = 10;
  const allPreviewRows = [...creates, ...updates];
  const previewTotal = allPreviewRows.length;
  const previewPageCount = Math.ceil(previewTotal / PREVIEW_PAGE_SIZE);
  const previewStart = previewPage * PREVIEW_PAGE_SIZE;
  const preview = allPreviewRows.slice(previewStart, previewStart + PREVIEW_PAGE_SIZE);
  const previewHeaders = preview.length ? Object.keys(preview[0]) : [];

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Bulk Import & Export</h1>
        <p className="text-sm text-gray-500 mt-1">
          Upload a CSV to create or update records. Leave <code className="bg-gray-100 px-1 rounded">docId</code> blank to create; fill it in to update. Importing and exporting run on the backend.
        </p>
      </div>

      {/* Collection selector */}
      <div className="space-y-2">
        <div className="flex flex-wrap gap-2">
          {COLLECTIONS.map((col) => (
            <Button
              key={col}
              variant="outline"
              size="sm"
              onClick={() => handleCollectionChange(col)}
              data-active={collection === col}
              className="px-3 py-1.5 text-sm rounded-lg border border-border transition-colors data-[active=true]:bg-primary data-[active=true]:text-white data-[active=true]:border-primary hover:bg-soft-grey hover:text-white"
            >
              {COLLECTION_LABELS[col]}
            </Button>
          ))}
        </div>
      </div>

      {/* Template + export actions */}
      <div className="flex flex-wrap items-center gap-3">
        <Button
          variant="outline"
          size="sm"
          onClick={() => generateTemplate(collection)}
        >
          <Download size={14} className="mr-1.5" />
          Download {COLLECTION_LABELS[collection]} Template
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handleExport}
          disabled={exporting}
        >
          <UploadIcon size={14} className="mr-1.5 rotate-180" />
          {exporting ? "Exporting…" : `Export ${COLLECTION_LABELS[collection]}`}
        </Button>
        <span className="text-xs text-gray-400">Template gives blank headers; Export downloads current data.</span>
      </div>

      {/* File upload */}
      <div
        className="border-2 border-dashed border-border rounded-xl p-8 text-center cursor-pointer hover:border-primary transition-colors"
        onClick={() => fileRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const dropped = e.dataTransfer.files?.[0];
          if (dropped && fileRef.current) {
            const dt = new DataTransfer();
            dt.items.add(dropped);
            fileRef.current.files = dt.files;
            fileRef.current.dispatchEvent(new Event("change", { bubbles: true }));
          }
        }}
      >
        <input
          ref={fileRef}
          type="file"
          accept=".csv"
          className="hidden"
          onChange={handleFile}
        />
        <Upload size={28} className="mx-auto mb-2 text-gray-400" />
        {fileName ? (
          <p className="text-sm font-medium flex items-center justify-center gap-1.5">
            <FileText size={14} />
            {fileName}
          </p>
        ) : (
          <p className="text-sm text-gray-500">
            Click or drag &amp; drop a <strong>.csv</strong> file here
          </p>
        )}
      </div>

      {/* File-level error */}
      {fileError && (
        <div className="flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 p-4 text-sm text-red-700">
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          <span>{fileError}</span>
        </div>
      )}

      {/* Per-row validation errors — these rows are left out of the preview and the import. */}
      {rowErrors.length > 0 && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 space-y-2">
          <p className="text-sm font-medium text-red-800 flex items-center gap-1.5">
            <AlertCircle size={14} />
            {rowErrors.length} row(s) will be skipped
          </p>
          <ul className="text-xs text-red-600 list-disc list-inside max-h-40 overflow-y-auto space-y-0.5">
            {rowErrors.map((e, i) => (
              <li key={i}>
                Row {e.row}: {e.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Preview table */}
      {preview.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium">
            Preview ({creates.length} to create, {updates.length} to update)
          </p>
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 border-b border-border">
                <tr>
                  <th className="px-3 py-2 text-right font-medium text-gray-400 whitespace-nowrap w-10">
                    #
                  </th>
                  {previewHeaders.map((h) => (
                    <th key={h} className="px-3 py-2 text-left font-medium text-gray-600 whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {preview.map((row, i) => (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="px-3 py-2 text-right text-gray-400 tabular-nums whitespace-nowrap">
                      {previewStart + i + 1}
                    </td>
                    {previewHeaders.map((h) => (
                      <td key={h} className="px-3 py-2 text-gray-700 whitespace-nowrap max-w-[200px] truncate">
                        {formatCell(row[h])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            {previewTotal > PREVIEW_PAGE_SIZE && (
              <div className="flex items-center justify-between px-3 py-2 border-t border-border">
                <p className="text-xs text-gray-400">
                  Showing {previewStart + 1}–{previewStart + preview.length} of {previewTotal} rows.
                </p>
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 w-7 p-0"
                    onClick={() => setPreviewPage((p) => Math.max(0, p - 1))}
                    disabled={previewPage === 0}
                    aria-label="Previous rows"
                  >
                    <ChevronLeft size={14} />
                  </Button>
                  <span className="text-xs text-gray-500 tabular-nums px-1">
                    {previewPage + 1} / {previewPageCount}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 w-7 p-0"
                    onClick={() => setPreviewPage((p) => Math.min(previewPageCount - 1, p + 1))}
                    disabled={previewPage >= previewPageCount - 1}
                    aria-label="Next rows"
                  >
                    <ChevronRight size={14} />
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Import button */}
      {hasData && (
        <div className="flex gap-3 items-center">
          <Button
            onClick={handleImport}
            disabled={!canImport || importing}
          >
            {importing ? "Importing…" : `Import ${creates.length + updates.length} row(s)`}
          </Button>
          <Button variant="outline" onClick={resetFile} disabled={importing}>
            Clear
          </Button>
        </div>
      )}

      {/* Post-import summary */}
      {summary && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-4 space-y-2">
          <p className="text-sm font-medium text-green-800 flex items-center gap-1.5">
            <CheckCircle2 size={14} />
            Import complete
          </p>
          <ul className="text-sm text-green-700 space-y-0.5">
            <li>{summary.created} document(s) created</li>
            <li>{summary.updated} document(s) updated</li>
            {summary.skipped > 0 && (
              <li className="text-amber-600">{summary.skipped} row(s) skipped</li>
            )}
            {summary.errors.length > 0 && (
              <li className="text-red-600">{summary.errors.length} row(s) failed</li>
            )}
          </ul>
          {summary.errors.length > 0 && (
            <ul className="text-xs text-red-600 list-disc list-inside max-h-32 overflow-y-auto">
              {summary.errors.map((e, i) => (
                <li key={i}>
                  {e.docId ?? (e.row != null ? `Row ${e.row}` : "Error")}: {e.message}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function formatCell(value: any): string {
  if (Array.isArray(value)) return value.join(" | ");
  if (value instanceof Date) return value.toISOString();
  if (value && typeof value === "object") return JSON.stringify(value);
  return String(value ?? "");
}

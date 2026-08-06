"use client";

import { useState, type ReactNode } from "react";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { StatusChip } from "@/components/ui/StatusChip";
import { ID_PREFIXES, SEQUENTIAL_ID_PADDING } from "@/app/utils/constant";
import { exampleDocId, type IdCollection } from "@/app/utils/idFormat";
import type { ImportError, ImportPreview, ImportRow, PreviewColumn } from "./types";

type GuideProps = {
  editable: readonly string[];
  required: readonly string[];
  note?: ReactNode;
};

/** A real record from the user's own data, shown as a copyable example docId. */
export type ExampleRecord = { docId: string; label: string };

type ImportCsvDialogProps = {
  /** Plural entity name, e.g. "Products". */
  entityLabel: string;
  /**
   * Which collection's ID scheme applies. Set it to show the expected docId format on
   * docId errors and in the guide; omit it and those fall back to plain prose.
   */
  idCollection?: IdCollection;
  /** An existing record, used as a concrete example alongside the format. */
  exampleRecord?: ExampleRecord;
  /** The field guide shown before a file is chosen. */
  guideOpen: boolean;
  onGuideOpenChange: (open: boolean) => void;
  guide: GuideProps;
  onChooseFile: () => void;
  /** Non-null once a file has been parsed, which opens the preview step. */
  preview: ImportPreview | null;
  onPreviewClose: () => void;
  /** Overrides the columns derived from `guide.editable`. Rarely needed. */
  columns?: PreviewColumn[];
  loading: boolean;
  onConfirm: () => void;
};

/** The docId shape for `collection`, e.g. "CAT- followed by 6 digits". */
function describeDocIdFormat(collection: IdCollection): string {
  return `${ID_PREFIXES[collection]}- followed by ${SEQUENTIAL_ID_PADDING} digits`;
}

/**
 * The first record with a usable docId, for the `exampleRecord` prop. Returns undefined
 * for an empty collection, which drops the example line rather than showing a blank one.
 */
export function firstExampleRecord(
  records: readonly { docId?: string; name?: string }[],
): ExampleRecord | undefined {
  const found = records.find((r) => Boolean(r.docId));
  return found ? { docId: found.docId!, label: found.name ?? "" } : undefined;
}

/** `availableToStores` → "Available To Stores". `docId` is left as-is. */
function humanizeFieldName(field: string): string {
  if (field === "docId") return "docId";
  const spaced = field.replace(/([a-z0-9])([A-Z])/g, "$1 $2");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/**
 * Every importable field gets a column, so a row's failing field is always
 * visible in the table rather than hidden behind the per-row error dialog.
 */
function deriveColumns(editable: readonly string[]): PreviewColumn[] {
  return ["docId", ...editable].map((key) => ({
    key,
    header: humanizeFieldName(key),
  }));
}

function FieldPill({ name, required }: { name: string; required?: boolean }) {
  return (
    <span
      className={
        required
          ? "rounded-md border border-amber-300 bg-amber-50 px-2 py-0.5 font-mono text-xs text-amber-800"
          : "rounded-md border border-border bg-background px-2 py-0.5 font-mono text-xs text-black"
      }
    >
      {name}
    </span>
  );
}

type ErrorExplanation = {
  problem: string;
  solution: string;
  /** Shown for docId errors, where the format itself is the answer. */
  format?: {
    pattern: string;
    description: string;
    example?: ExampleRecord;
  };
};

/**
 * Turns a validator's terse `reason` into something a shop manager can act on.
 * Matched loosely against the reason text so no validator has to change; the
 * fallback keeps any future message readable.
 *
 * `context` is only needed for docId errors, which answer with the expected format
 * rather than prose describing where to find one.
 */
function explainError(
  { field, reason }: ImportError,
  context: {
    entityLabel: string;
    idCollection?: IdCollection;
    exampleRecord?: ExampleRecord;
  },
): ErrorExplanation {
  const r = reason.toLowerCase();

  // Both docId format failures — wrong section and unparseable — answer the same way:
  // show the correct shape. Must precede the "not found" branches below, which would
  // otherwise advise clearing the docId and silently create a junk record.
  const isDocIdFormatError =
    r.includes("id — this file imports") ||
    (r.includes("is not a valid") && r.includes("id (expected"));

  if (isDocIdFormatError) {
    return {
      problem: `This row's docId isn't a valid ${context.entityLabel} ID.`,
      solution: `Leave docId blank to create a new record instead.`,
      // Without a collection there is no format to show, so the card renders the
      // problem and action line alone rather than an empty block.
      format: context.idCollection
        ? {
            pattern: exampleDocId(context.idCollection),
            description: describeDocIdFormat(context.idCollection),
            example: context.exampleRecord,
          }
        : undefined,
    };
  }
  if (r.includes("not found — cannot update")) {
    return {
      problem: `No existing record matches the docId in this row.`,
      solution:
        "Clear the docId to create a new record instead, or copy the correct docId from a fresh CSV export.",
    };
  }
  if (r.includes("already exists")) {
    return {
      problem: `Another record already uses this ${field}.`,
      solution: `Give this row a different ${field}, or add the existing record's docId to update it instead of creating a duplicate.`,
    };
  }
  if (r.includes("duplicates row")) {
    return {
      problem: `Two rows in this file share the same ${field}.`,
      solution: `Make each ${field} unique, or delete the row you don't need.`,
    };
  }
  if (r.includes("is required")) {
    return {
      problem: `${field} is empty, and it's required when creating a new record.`,
      solution: `Fill in ${field} for this row, or add a docId if you meant to update an existing record.`,
    };
  }
  if (r.includes("non-negative")) {
    return {
      problem: `${field} must be a number that isn't negative.`,
      solution:
        "Use digits only — no currency symbols, commas or spaces. Example: 120 or 99.50",
    };
  }
  if (r.includes("valid integer")) {
    return {
      problem: `${field} must be a whole number.`,
      solution: "Use a whole number with no decimal point. Example: 3",
    };
  }
  if (r.includes("valid number")) {
    return {
      problem: `${field} isn't a number.`,
      solution:
        "Use digits only — no currency symbols, commas or spaces. Example: 3",
    };
  }
  if (r.includes('"true" or "false"')) {
    return {
      problem: `${field} must be either true or false.`,
      solution: 'Type exactly true or false — nothing else, and no quotes.',
    };
  }
  if (r.includes("lat,lng")) {
    return {
      problem: "The location isn't a valid coordinate pair.",
      solution:
        "Use latitude,longitude with a comma between them. Example: 14.5995,120.9842",
    };
  }
  if (r.includes("was deleted and can no longer be assigned")) {
    return {
      problem: `The ${field} in this row points at a record that has been deleted.`,
      solution:
        "Pick a different one, or clear this column to leave it unset. Deleted records can't be assigned.",
    };
  }
  if (r.includes("unknown") && r.includes("ids")) {
    return {
      problem: `${field} refers to records that don't exist.`,
      solution:
        "Check the IDs against a fresh CSV export of that section, then fix or remove the ones listed above. Separate multiple IDs with commas.",
    };
  }
  if (r.includes("not found")) {
    return {
      problem: `The ${field} in this row doesn't match any existing record.`,
      solution:
        "Check the spelling, or create that record first and then re-import this file.",
    };
  }

  return {
    problem: reason,
    solution: `Correct ${field} in your CSV, then upload the file again.`,
  };
}

export function ImportCsvDialog({
  entityLabel,
  idCollection,
  exampleRecord,
  guideOpen,
  onGuideOpenChange,
  guide,
  onChooseFile,
  preview,
  onPreviewClose,
  columns: columnsOverride,
  loading,
  onConfirm,
}: ImportCsvDialogProps) {
  const [errorRow, setErrorRow] = useState<ImportRow | null>(null);

  const columns = columnsOverride ?? deriveColumns(guide.editable);
  const rows = preview?.rows ?? [];
  const createCount = rows.filter((r) => r.action === "create").length;
  const updateCount = rows.filter((r) => r.action === "update").length;
  const importableRows = rows.filter((r) => r.action !== "error");
  const errorCount = rows.length - importableRows.length;

  return (
    <>
      {/* Step 1 — field guide */}
      <Dialog open={guideOpen} onOpenChange={onGuideOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>CSV Import Guide — {entityLabel}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2 text-sm">
            <div className="space-y-1.5">
              <p className="font-medium text-black">Editable fields</p>
              <div className="flex flex-wrap gap-1.5">
                {guide.editable.map((f) => (
                  <FieldPill key={f} name={f} />
                ))}
              </div>
            </div>
            {guide.required.length > 0 && (
              <div className="space-y-1.5">
                <p className="font-medium text-black">
                  Required fields{" "}
                  <span className="text-xs font-normal text-light-grey">
                    (for new rows)
                  </span>
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {guide.required.map((f) => (
                    <FieldPill key={f} name={f} required />
                  ))}
                </div>
              </div>
            )}
            <p className="text-xs leading-relaxed text-light-grey">
              Include <span className="font-mono text-black">docId</span> to
              update an existing record. Leave it blank to create a new one.
              {idCollection && (
                <>
                  {" "}
                  A {entityLabel} docId looks like{" "}
                  <span className="font-mono text-black">
                    {exampleDocId(idCollection)}
                  </span>
                  {" — "}
                  {describeDocIdFormat(idCollection)}.
                </>
              )}{" "}
              A docId belonging to a deleted {entityLabel.toLowerCase()} restores it —
              the record itself only, not anything deleted alongside it.
            </p>
            {guide.note}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => onGuideOpenChange(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                onGuideOpenChange(false);
                onChooseFile();
              }}
            >
              Choose File →
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Step 2 — preview with per-row create/update status */}
      <Dialog
        open={preview !== null}
        onOpenChange={(open) => {
          if (!open) onPreviewClose();
        }}
      >
        <DialogContent className="max-w-5xl">
          <DialogHeader>
            <DialogTitle>Import Preview — {entityLabel}</DialogTitle>
          </DialogHeader>

          <div className="max-h-[65vh] space-y-4 overflow-y-auto py-2">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <StatusChip label={`${createCount} to create`} color="green" />
              <StatusChip label={`${updateCount} to update`} color="blue" />
              {errorCount > 0 && (
                <StatusChip
                  label={`${errorCount} row${errorCount !== 1 ? "s" : ""} with errors`}
                  color="red"
                />
              )}
            </div>

            {rows.length > 0 && (
              <div className="overflow-x-auto rounded-xl border border-border bg-white">
                <table className="w-max min-w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-background">
                      <th className="px-3 py-2 text-left font-medium whitespace-nowrap text-black">
                        Row
                      </th>
                      {columns.map((c) => (
                        <th
                          key={c.key}
                          className="px-3 py-2 text-left font-medium whitespace-nowrap text-black"
                        >
                          {c.header}
                        </th>
                      ))}
                      <th className="px-3 py-2 text-right font-medium whitespace-nowrap text-black">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {rows.map((r) => {
                      const failed = r.action === "error";
                      // Marks the exact cells that failed, so the bad value is
                      // visible without opening the per-row error dialog.
                      const reasonByField = new Map(
                        (r.errors ?? []).map((e) => [e.field, e.reason]),
                      );
                      return (
                        <tr key={r.rowNum} className={failed ? "bg-red-50/50" : undefined}>
                          <td className="px-3 py-2 whitespace-nowrap text-black">
                            {r.rowNum}
                          </td>
                          {columns.map((c) => {
                            const value = r.data[c.key] ?? "";
                            const reason = reasonByField.get(c.key);
                            return (
                              <td
                                key={c.key}
                                title={reason ?? (value || undefined)}
                                className={
                                  reason
                                    ? "px-3 py-2 bg-red-100 font-medium text-error"
                                    : "px-3 py-2 text-black"
                                }
                              >
                                {/* max-width + truncate need a block box; a <td>
                                    ignores them, so the inner span carries them. */}
                                <span className="block max-w-[16rem] truncate">
                                  {value.trim() ? (
                                    value
                                  ) : (
                                    <span className={reason ? "text-error" : "text-gray-400"}>
                                      —
                                    </span>
                                  )}
                                </span>
                              </td>
                            );
                          })}
                          <td className="px-3 py-2 text-right whitespace-nowrap">
                            <span className="inline-flex items-center gap-1">
                              <StatusChip
                                label={
                                  failed
                                    ? "Error"
                                    : r.action === "create"
                                      ? "Create"
                                      : "Update"
                                }
                                color={
                                  failed
                                    ? "red"
                                    : r.action === "create"
                                      ? "green"
                                      : "blue"
                                }
                              />
                              {failed && (
                                <button
                                  type="button"
                                  onClick={() => setErrorRow(r)}
                                  aria-label={`View errors for row ${r.rowNum}`}
                                  title="View errors"
                                  className="rounded-full p-1 text-error transition-colors hover:bg-red-100"
                                >
                                  <AlertCircle className="h-4 w-4" />
                                </button>
                              )}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {importableRows.length === 0 && (
              <p className="text-sm text-black">No valid rows to import.</p>
            )}
          </div>

          <DialogFooter>
            {errorCount > 0 && (
              <p className="mr-auto text-xs text-light-grey">
                {errorCount} row{errorCount !== 1 ? "s" : ""} with errors will be
                skipped.
              </p>
            )}
            <Button variant="outline" onClick={onPreviewClose} disabled={loading}>
              Cancel
            </Button>
            {importableRows.length > 0 && (
              <Button onClick={onConfirm} disabled={loading}>
                {loading
                  ? "Importing…"
                  : `Import ${importableRows.length} row${importableRows.length !== 1 ? "s" : ""}`}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Step 2b — why a single row failed */}
      <Dialog
        open={errorRow !== null}
        onOpenChange={(open) => {
          if (!open) setErrorRow(null);
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Row {errorRow?.rowNum} couldn&apos;t be imported</DialogTitle>
          </DialogHeader>

          <div className="max-h-[60vh] space-y-3 overflow-y-auto py-2">
            {(errorRow?.errors ?? []).map((e, i) => {
              const { problem, solution, format } = explainError(e, {
                entityLabel,
                idCollection,
                exampleRecord,
              });
              return (
                <div
                  key={i}
                  className="space-y-2 rounded-xl border border-border bg-background p-3"
                >
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 shrink-0 text-error" />
                    <span className="font-mono text-xs text-black">{e.field}</span>
                  </div>
                  <p className="text-sm text-black">{problem}</p>
                  {format && (
                    <div className="space-y-2 rounded-lg bg-white p-2.5">
                      <div>
                        <p className="text-xs font-medium text-black">
                          Correct format for {entityLabel}
                        </p>
                        <p className="mt-1 font-mono text-sm text-black">
                          {format.pattern}
                        </p>
                        <p className="mt-0.5 text-xs text-light-grey">
                          {format.description}
                        </p>
                      </div>
                      {format.example && (
                        <div className="border-t border-border pt-2">
                          <p className="text-xs font-medium text-black">
                            Example from your {entityLabel.toLowerCase()}
                          </p>
                          <p className="mt-1 font-mono text-sm text-black">
                            {format.example.docId}
                            {format.example.label && (
                              <span className="ml-2 font-sans text-xs text-light-grey">
                                ({format.example.label})
                              </span>
                            )}
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                  <div className="rounded-lg bg-white p-2.5">
                    <p className="text-xs font-medium text-black">How to fix</p>
                    <p className="mt-0.5 text-xs leading-relaxed text-light-grey">
                      {solution}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          <DialogFooter>
            <Button onClick={() => setErrorRow(null)}>Got it</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

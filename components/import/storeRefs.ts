import { parseArrayCell } from "@/app/utils/csvUtils";
import {
  collectionForDocId,
  exampleDocId,
  isValidDocId,
  labelForCollection,
  type IdCollection,
} from "@/app/utils/idFormat";
import type { ImportError } from "./types";

export type PartitionedIds = {
  /** IDs that match a live record. */
  live: string[];
  /** IDs that match a soft-deleted record — dropped on import, not an error. */
  deleted: string[];
  /** IDs that match nothing at all — a genuine mistake in the CSV. */
  unknown: string[];
};

/**
 * Sorts referenced IDs into live, soft-deleted and unknown.
 *
 * The dashboard stores hold only live records, so a soft-deleted ID and a typo look
 * identical to a validator that checks one list. Passing the unfiltered list too
 * lets importers strip stale references silently while still rejecting real typos.
 */
export function partitionIds(
  ids: readonly string[],
  liveIds: readonly string[],
  allIds: readonly string[],
): PartitionedIds {
  const live: string[] = [];
  const deleted: string[] = [];
  const unknown: string[] = [];

  ids.forEach((id) => {
    if (liveIds.includes(id)) live.push(id);
    else if (allIds.includes(id)) deleted.push(id);
    else unknown.push(id);
  });

  return { live, deleted, unknown };
}

/** `partitionIds` for a raw CSV cell holding a JSON or pipe-delimited list. */
export function partitionIdCell(
  raw: string | undefined,
  liveIds: readonly string[],
  allIds: readonly string[],
): PartitionedIds {
  return partitionIds(parseArrayCell(raw ?? ""), liveIds, allIds);
}

export type DocIdTarget = "live" | "deleted" | "unknown";

/**
 * Classifies a row's own docId against the live and unfiltered ID lists.
 *
 * A soft-deleted target is not an error: the CSV is the source of truth, so re-importing
 * a row deleted after the export was taken restores that record rather than rejecting it.
 * Only an ID matching nothing at all is a genuine mistake. See partitionIds for the same
 * three-way split applied to referenced IDs.
 */
export function classifyDocIdTarget(
  docId: string,
  liveIds: readonly string[],
  allIds: readonly string[],
): DocIdTarget {
  if (liveIds.includes(docId)) return "live";
  if (allIds.includes(docId)) return "deleted";
  return "unknown";
}

/** Reason text for a scalar reference pointing at a soft-deleted record. */
export function deletedRefReason(label: string, id: string): string {
  return `${label} "${id}" was deleted and can no longer be assigned`;
}

/**
 * Checks a docId cell looks like an ID belonging to `expected` before any existence
 * check runs.
 *
 * Without this, a products CSV imported into Categories fails only because PRD-000001
 * isn't in the categories list — indistinguishable from a typo, and the dialog then
 * advises clearing the docId, which would create a junk record instead of sending the
 * user to the right section.
 *
 * Returns null for an empty cell: that's the create path, not an error.
 */
export function validateDocIdFormat(
  docId: string | undefined,
  expected: IdCollection,
  rowNum: number,
): ImportError | null {
  const trimmed = (docId ?? "").trim();
  if (!trimmed || isValidDocId(trimmed, expected)) return null;

  const expectedLabel = labelForCollection(expected);
  const actual = collectionForDocId(trimmed);

  return {
    row: rowNum,
    field: "docId",
    reason: actual
      ? `docId "${trimmed}" is a ${labelForCollection(actual)} ID — this file imports ${expectedLabel}`
      : `docId "${trimmed}" is not a valid ${expectedLabel} ID (expected ${exampleDocId(expected)})`,
  };
}

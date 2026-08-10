export interface ModifierGroup {
  docId?: string;
  modifierIds: string[];
  name?: string;
  // required?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
  isDeleted?: boolean;
  /** Null once a CSV re-import has restored a soft-deleted modifier group. */
  deletedAt?: Date | null;
  order?: number;
  // selectionType?: string;
}

/**
 * True when another modifier group already uses this name.
 * Matching is case-insensitive and ignores surrounding whitespace.
 * Pass `excludeDocId` when editing so a group doesn't collide with itself.
 */
export function isModifierGroupNameTaken(
  groups: readonly ModifierGroup[],
  name: string,
  excludeDocId?: string,
): boolean {
  const target = name.trim().toLowerCase();
  if (target === "") return false;
  return groups.some(
    (g) => g.docId !== excludeDocId && (g.name ?? "").trim().toLowerCase() === target,
  );
}

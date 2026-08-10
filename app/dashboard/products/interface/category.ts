import { Product } from "./product";

export interface Category {
  docId?: string;
  name?: string;
  order?: number;
  createdAt?: Date;
  updatedAt?: Date;
  imageUrl?: string;
  isDeleted?: boolean;
  /** Null once a CSV re-import has restored a soft-deleted category. */
  deletedAt?: Date | null;
}

/**
 * Doc IDs of the products referencing `categoryId`. Callers use this to warn about or
 * cascade a category delete.
 */
export function productIdsReferencingCategory(
  products: readonly Product[],
  categoryId: string,
): string[] {
  return products
    .filter((p) => p.categoryId === categoryId)
    .map((p) => p.docId)
    .filter((id): id is string => Boolean(id));
}

/**
 * True when another category already uses this name.
 * Matching is case-insensitive and ignores surrounding whitespace.
 * Pass `excludeDocId` when editing so a category doesn't collide with itself.
 */
export function isCategoryNameTaken(
  categories: readonly Category[],
  name: string,
  excludeDocId?: string,
): boolean {
  const target = name.trim().toLowerCase();
  if (target === "") return false;
  return categories.some(
    (c) => c.docId !== excludeDocId && (c.name ?? "").trim().toLowerCase() === target,
  );
}

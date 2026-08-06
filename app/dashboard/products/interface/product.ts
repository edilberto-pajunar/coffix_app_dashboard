export interface Product {
  availableToStores?: string[];
  categoryId?: string;
  cost?: number;
  docId?: string;
  imageUrl?: string;
  modifierGroupIds?: string[];
  name?: string;
  order?: number;
  price?: number;
  disabledStores?: string[];
  createdAt?: Date;
  updatedAt?: Date;
  isDeleted?: boolean;
  /** Null once a CSV re-import has restored a soft-deleted product. */
  deletedAt?: Date | null;
}

/**
 * Doc IDs of the products referencing `storeId` from either store field. Callers pass
 * these to StoreService.deleteStoreCascade so the delete can detach the store in the
 * same batch.
 */
export function productIdsReferencingStore(
  products: readonly Product[],
  storeId: string,
): string[] {
  return products
    .filter(
      (p) =>
        (p.availableToStores ?? []).includes(storeId) ||
        (p.disabledStores ?? []).includes(storeId),
    )
    .map((p) => p.docId)
    .filter((id): id is string => Boolean(id));
}

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

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

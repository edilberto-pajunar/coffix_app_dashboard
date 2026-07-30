export interface ModifierGroup {
  docId?: string;
  modifierIds: string[];
  name?: string;
  // required?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
  isDeleted?: boolean;
  deletedAt?: Date;
  order?: number;
  // selectionType?: string;
}

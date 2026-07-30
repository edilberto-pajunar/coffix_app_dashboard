export interface Modifier {
  docId?: string;
  groupId?: string;
  isDefault?: boolean;
  label?: string;
  priceDelta?: number;
  cost?: number;
  createdAt?: Date;
  updatedAt?: Date;
  isDeleted?: boolean;
  deletedAt?: Date;
  order?: number;
}

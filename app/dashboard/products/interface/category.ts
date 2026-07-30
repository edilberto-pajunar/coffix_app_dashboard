export interface Category {
  docId?: string;
  name?: string;
  order?: number;
  createdAt?: Date;
  updatedAt?: Date;
  imageUrl?: string;
  isDeleted?: boolean;
  deletedAt?: Date;
}

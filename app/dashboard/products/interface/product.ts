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
  disabledPermanently?: boolean;
  disabledStores?: string[];
}

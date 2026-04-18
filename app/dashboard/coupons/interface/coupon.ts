export interface Coupon {
  docId?: string;
  code?: string;
  type?: string;
  amount?: number;
  expiryDate?: Date;
  storeId?: string;
  notes?: string;
  userIds?: string[];
  usageLimit?: number;
  usageCount?: number;
  source?: string;
  referralId?: string;
  isUsed?: boolean;
  createdAt?: Date;
}

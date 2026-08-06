export interface Coupon {
  docId?: string;
  amount?: number;
  expiryDate?: Date;
  storeId?: string;
  createdAt?: Date;
  customerEmail?: string;
  notes?: string;
  type?: string; // referral | admin
  userId?: string;
  updatedAt?: Date;
  remainingAmount?: number;
}

import { PaymentMethod } from "./transaction";

export type OrderStatus =
  | 'draft'
  | 'pending_payment'
  | 'confirmed'
  | 'preparing'
  | 'ready'
  | 'paid'
  | 'completed'
  | 'cancelled'
  | 'pending';

// Replace this with your actual PaymentStatus type if you have one already
export type PaymentStatus = string;

export interface Order {
  docId?: string | null;
  customerId?: string | null;
  storeId?: string | null;
  amount?: number | null;
  createdAt?: string | null;
  scheduledAt?: string | null;
  items?: Item[] | null;
  status?: OrderStatus | null;
  paymentStatus?: PaymentStatus | null;
  paymentMethod?: PaymentMethod | null;
  storeName?: string | null;
  transactionNumber?: string | null;
}

export interface Item {
  productId?: string | null;
  productName?: string | null;
  productImageUrl?: string | null;
  price?: number | null;
  basePrice?: number | null;
  quantity?: number | null;
  selectedModifiers?: Record<string, string> | null;
  modifiers?: ItemModifier[] | null;
}

export interface ItemModifier {
  modifierId?: string | null;
  priceDelta?: number | null;
}
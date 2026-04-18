export type TransactionStatus =
  | 'created'
  | 'paid'
  | 'failed'
  | 'approved'
  | 'declined'
  | 'completed';

export type PaymentMethod =
  | 'coffixCredit'
  | 'card'
  | 'wallet';

export interface Transaction {
  docId?: string | null;
  orderId?: string | null;
  customerId?: string | null;
  amount?: number | null;
  createdAt?: Date | null; // ISO string from API
  status?: TransactionStatus | null;
  paymentMethod?: PaymentMethod | null;
  paymentId?: string | null;
  paymentTime?: string | null;
  orderNumber?: string | null;
  type?: string | null;
  recipientCustomerId?: string | null;
  recipientEmail?: string | null;
  recipientFullName?: string | null;
  senderFirstName?: string | null;
  senderLastName?: string | null;
  transactionNumber?: string | null;
  totalAmount?: number | null;

  // GST fields
  gst?: number | null;
  gstAmount?: number | null;
  gstNumber?: number | null;
}
export interface Log {
  docId?: string;
  page?: string;
  customerId?: string; // if under customers collection
  userId?: string; // if under staffs collection
  category?: string; // refund, purchase, referral, info update, bonus
  severityLevel?: string; // error, warning, info, success
  action?: string;
  notes?: string;
  time?: Date;
}

export type StaffRole = "admin" | "store_manager";

export interface Staff {
  docId: string;
  email: string;
  role: StaffRole;
  storeIds?: string[];
  disabled: boolean;
  createdAt?: unknown;
  firstName?: string;
  lastName?: string;
}

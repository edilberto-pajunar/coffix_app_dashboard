import { Timestamp } from "firebase/firestore";

export interface EmailTemplate {
  docId: string;
  name: string;
  content: string;
  variables?: string[];
  notes?: string;
  updatedAt?: Timestamp;
  updatedBy?: string;
}

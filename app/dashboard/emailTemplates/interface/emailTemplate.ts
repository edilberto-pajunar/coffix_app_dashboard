import { Timestamp } from "firebase/firestore";

export interface EmailTemplate {
  docId: string;
  name: string;
  subject: string;
  content: string;
  notes?: string;
  updatedAt?: Timestamp;
  updatedBy?: string;
}

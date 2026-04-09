import { Timestamp } from "firebase/firestore";

export type NotificationChannel = "in_app" | "popup" | "email" | "sms";
export type ScheduleMode = "immediate" | "scheduled" | "recurring";
export type CampaignStatus = "draft" | "scheduled" | "sent" | "cancelled";

export interface UserFilter {
  field: string;
  operator: "==" | "!=" | ">=" | "<=" | ">" | "<" | "array-contains";
  value: string | number | boolean;
}

export interface NotificationCampaign {
  docId: string;
  name: string;
  channels: NotificationChannel[];
  audience: {
    storeIds?: string[];
    birthdayMonth?: number; // 1–12
    filters?: UserFilter[];
    filterLogic?: "AND" | "OR";
  };
  template: {
    title: string;
    body: string;
    buttonText?: string; // popup only
    buttonUrl?: string; // popup only
    imageUrl?: string; // popup/email only
    subject?: string; // email only
    preheader?: string; // email only
  };
  schedule: {
    mode: ScheduleMode;
    sendAt?: Timestamp;
    recurrence?: "daily" | "weekly" | "monthly";
  };
  status: CampaignStatus;
  createdBy: string;
  createdAt: Timestamp;
  sentAt?: Timestamp;
}

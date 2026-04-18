export interface AppUser {
  creditAvailable?: number;
  docId?: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  nickName?: string;
  mobile?: string;
  birthday?: Date;
  suburb?: string;
  city?: string;
  preferredStoreId?: string;
  preferredStoreName?: string;
  createdAt?: Date;
  emailVerified?: boolean;
  getPurchaseInfoByMail?: boolean;
  getPromotions?: boolean;
  allowWinACoffee?: boolean;
  lastLogin?: Date;
  disabled?: boolean;
  qrId?: string;
  fcmToken?: string;
  appVersion?: string;
  creditExpiry?: Date;
}

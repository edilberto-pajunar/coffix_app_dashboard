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
  createdAt?: Date;
  emailVerified?: boolean;
  lastLogin?: Date;
  disabled?: boolean;
  qrId?: string;
  fcmToken?: string;
  appVersion?: string;
  creditExpiry?: Date;

  // Flags for different features
  scheduleOrder?: boolean;
  shareCredit?: boolean;
  withdrawBalance?: boolean;
  coffixCreditAvailable?: boolean;
  getPurchaseInfoByMail?: boolean;
  getPromotions?: boolean;
  allowWinACoffee?: boolean;
  allowCoffeeForHome?: boolean;
  allowNotifications?: boolean;
}

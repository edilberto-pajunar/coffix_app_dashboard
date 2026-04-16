export interface EmailVariableGroup {
  key: string;
  label: string;
  variables: string[];
}

export const EMAIL_VARIABLE_GROUPS: EmailVariableGroup[] = [
  {
    key: "general",
    label: "General (User Fields)",
    variables: [
      "first_name",
      "last_name",
      "nick_name",
      "email",
      "mobile",
      "birthday",
      "suburb",
      "city",
      "preferred_store_id",
      "credit_available",
      "created_at",
      "email_verified",
      "get_purchase_info_by_mail",
      "get_promotions",
      "allow_win_a_coffee",
      "last_login",
      "disabled",
      "qr_id",
      "fcm_token",
      "doc_id",
      "date",
    ],
  },
  {
    key: "otp",
    label: "OTP",
    variables: ["otp_code", "expiry_time", "user_email"],
  },
];

export const DEFAULT_VARIABLE_GROUP_KEY = "general";

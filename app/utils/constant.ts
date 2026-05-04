import { EmailVariableGroup } from "../dashboard/emailTemplates/constants/emailVariables";

const COLLECTION_GLOBAL_SETTINGS = "EQ0i4V6H47Ra7yMCdG7B";
const WEBAPP_VERSION = "1.0.0+34";

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
    variables: ["otp_code", "expiry_time", "user_email", "reset_url"],
  },
  {
    key: "transaction",
    label: "Transaction",
    variables: ["invoice", "gift_amount", "transaction_number", "store_name" ],
  },
  {
    key: "referral",
    label: "Referral",
    variables: ["referee_name"],
  },
 
];

export const SUBJECT_VARIABLES = ["transaction_number", "store_name"];

export { COLLECTION_GLOBAL_SETTINGS, WEBAPP_VERSION };

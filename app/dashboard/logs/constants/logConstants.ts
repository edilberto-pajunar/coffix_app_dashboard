/**
 * Values used when writing logs. Keeps `category` / `severityLevel` / `page`
 * from being stringly typed at every call site.
 *
 * See `logFieldConstants.ts` for the CSV import/export field lists — a
 * different concern.
 */

/**
 * The domain the log belongs to. The actor is captured by `userId`, not here.
 */
export const LOG_CATEGORY = {
  PRODUCT: "Product",
  CATEGORIES: "Categories",
  STORES: "Stores",
  MODIFIER_GROUPS: "Modifier Groups",
  CUSTOMERS: "Customers",
  USERS: "Users",
  TRANSACTION: "Transaction",
  REFUND: "Refund",
  COUPON: "Coupon",
  EMAIL_TEMPLATES: "Email Templates",
  GLOBAL_SETTINGS: "Global Settings",
  LOGS: "Logs",
  IMPORT: "Import",
} as const;

/**
 * How significant the action is.
 *
 * 1 = low (login, forgot password), 3–5 = mid (errors, admin edits),
 * 9 = high (financial transactions, kept long term).
 */
export const LOG_SEVERITY = {
  LOW: 1,
  MEDIUM: 3,
  HIGH: 5,
  CRITICAL: 9,
} as const;

/**
 * The dashboard page the action was triggered from.
 */
export const LOG_PAGE = {
  PRODUCTS: "Products",
  CATEGORIES: "Categories",
  STORES: "Stores",
  MODIFIER_GROUPS: "Modifier Groups",
  CUSTOMERS: "Customers",
  TRANSACTIONS: "Transactions",
  USERS: "Users",
  GLOBAL_SETTINGS: "Global Settings",
  EMAIL_TEMPLATES: "Email Templates",
  COUPONS: "Coupons",
  LOGS: "Logs",
  IMPORT: "Import",
} as const;

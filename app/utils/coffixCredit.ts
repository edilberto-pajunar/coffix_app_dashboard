import { Transaction } from "@/app/dashboard/transactions/interface/transaction";
import { Coupon } from "@/app/dashboard/coupons/interface/coupon";

/**
 * Coffix credit reconciliation utilities.
 *
 * The user's stored coffix credit balance lives in `creditAvailable` on the user
 * document. Separately, every credit movement is recorded in the top-level
 * `transactions` collection. These helpers re-derive a user's balance purely from
 * their `paymentMethod === "coffixCredit"` transactions so the stored balance can
 * be reconciled against the transaction history.
 *
 * All amounts are treated as positive magnitudes; direction (add vs subtract) is
 * decided by transaction `type` via COFFIX_CREDIT_SIGN — so the math is robust
 * whether or not `amount` is already signed in the data.
 */

/**
 * Maps a transaction `type` to its effect on coffix credit:
 *   +1 → adds credit, -1 → subtracts credit, 0 (absent) → ignored.
 *
 * This is the single place to tune the add/subtract convention. Unknown / unlisted
 * types are intentionally IGNORED (treated as 0) rather than guessed, so an
 * unexpected type can never silently corrupt the accumulated total.
 *
 * Note: `gift` direction depends on whether the user sent or received it; that is
 * handled in signedCoffixAmount, not here.
 */
export const COFFIX_CREDIT_SIGN: Record<string, 1 | -1> = {
  // Adds credit
  topup: 1,
  refund: 1,
  credit: 1,
  // coupon / referral ledger rows are intentionally omitted — they issue a
  // coupon document, they do not change creditAvailable.
  // Subtracts credit
  order: -1,
  purchase: -1,
};

/**
 * Statuses that mean the transaction never settled — e.g. a Windcave top-up
 * session left in `created` after the user abandoned checkout. Counting these
 * double-counts against a later `approved` top-up of the same amount.
 * Missing/null status is treated as settled for legacy documents.
 */
const UNSETTLED_STATUSES = new Set([
  "created",
  "pending",
  "failed",
  "declined",
  "expired",
  "payment_failed",
  "processing",
]);

const EPSILON = 0.005; // half a cent — guards against float noise

function roundCents(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Signed contribution of a single transaction to `userId`'s coffix credit.
 * Returns 0 if the transaction's type is unknown or it doesn't affect this user.
 *
 * Spending magnitudes are net of the coupon(s) applied: for `order`/`purchase` the
 * credit actually drawn is `amount − couponAmount` (since `amount` is the full
 * pre-coupon price), clamped at 0 so an oversized coupon can never add credit.
 * The coupon amount is looked up via `tx.couponIds` against `couponsById` rather
 * than trusting `tx.couponDiscount` directly, since that field is not reliably
 * populated on transaction documents; `couponDiscount` is used only as a fallback
 * when no linked coupons are found.
 */
export function signedCoffixAmount(
  tx: Transaction,
  userId: string,
  couponsById: Map<string, Coupon>,
): number {
  const sign = COFFIX_CREDIT_SIGN[tx.type ?? ""];

  // Spending (order/purchase) draws amount − coupon; credit-adds prefer
  // totalAmount (amount + bonus); gift falls through and uses amount.
  let rawAmount: number;
  if (sign === -1) {
    const couponTotal = (tx.couponIds ?? [])
      .map((id) => couponsById.get(id)?.amount ?? 0)
      .reduce((a, b) => a + b, 0);
    const coupon =
      couponTotal > 0 ? couponTotal : Math.abs(tx.couponDiscount ?? 0);
    rawAmount = Math.max(0, Math.abs(tx.amount ?? 0) - coupon);
  } else {
    rawAmount =
      sign === 1 ? (tx.totalAmount ?? tx.amount ?? 0) : (tx.amount ?? 0);
  }
  const magnitude = Math.abs(rawAmount);
  if (magnitude === 0) return 0;

  // Gift / transfer: direction depends on who the user is.
  if (tx.type === "gift") {
    if (tx.recipientCustomerId === userId) return magnitude; // received → +
    if (tx.customerId === userId) return -magnitude; // sent → -
    return 0;
  }

  if (!sign) return 0; // unknown type → ignored
  return sign * magnitude;
}

/**
 * Sum of all coffix-credit transactions for `userId`, re-deriving the balance.
 * Both credit-adding types (topup, refund, etc.) and spending types (order,
 * purchase) only count when `paymentMethod === "coffixCredit"` — the money must
 * have actually moved through coffix credit. A cash/card refund or topup does
 * not touch the coffix balance and is ignored here. Credit-adds use `totalAmount`
 * when available (which includes any topup bonus), falling back to `amount`;
 * spending is netted against the linked coupons' amount (see signedCoffixAmount).
 * `topup` and `gift` are exempt from the payment-method gate — a top-up always
 * credits the coffix balance regardless of how it was paid (card/cash), and
 * `gift` is an inherent coffix-credit transfer handled separately in
 * signedCoffixAmount.
 */
export function accumulateCoffixCredit(
  transactions: Transaction[],
  userId: string,
  couponsById: Map<string, Coupon>,
): number {
  let total = 0;
  for (const tx of transactions) {
    if (tx.customerId !== userId && tx.recipientCustomerId !== userId) continue;
    if (tx.status && UNSETTLED_STATUSES.has(tx.status)) continue;
    const type = tx.type ?? "";
    // coffix-credit adds AND spends only count when the money actually moved
    // through coffix credit — a cash/card refund must NOT change the accumulated
    // coffix balance. topup and gift are exempt: a top-up always credits the
    // coffix balance regardless of how it was paid, and gift is an inherent
    // coffix transfer handled separately in signedCoffixAmount.
    if (
      type !== "topup" &&
      COFFIX_CREDIT_SIGN[type] &&
      tx.paymentMethod !== "coffixCredit"
    )
      continue;
    total += signedCoffixAmount(tx, userId, couponsById);
  }
  return roundCents(total);
}

/**
 * Compares the stored balance against the transaction-derived total.
 * `matches` uses a half-cent epsilon to absorb floating-point noise.
 */
export function reconcileCoffixCredit(
  current: number,
  accumulated: number,
): { matches: boolean; difference: number } {
  const difference = roundCents(current - accumulated);
  return { matches: Math.abs(difference) < EPSILON, difference };
}

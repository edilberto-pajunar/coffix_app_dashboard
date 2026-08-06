import { db } from "@/app/lib/firebase";
import { doc, runTransaction, Transaction } from "firebase/firestore";
import { SEQUENTIAL_ID_PADDING } from "./constant";

// Counter documents live in `counters/{key}` and hold `{ nextNumber: n }`, the next
// unused sequence value. Kept out of the entity collections so listeners on e.g.
// `products` never see them.
const COUNTERS_COLLECTION = "counters";

export interface SequentialIdOptions {
  /** Counter document key, usually the target collection name. e.g. "products" */
  counterKey: string;
  /** Human-readable prefix. e.g. "PRD" -> PRD-000001 */
  prefix: string;
  /** Zero-padded width of the numeric part. Default 6. */
  padding?: number;
}

export const formatSequentialId = (
  prefix: string,
  n: number,
  padding = SEQUENTIAL_ID_PADDING,
): string => `${prefix}-${String(n).padStart(padding, "0")}`;

// Reserves the next sequence number for `counterKey` and returns the formatted code.
// Must be called inside a transaction so the read-modify-write of the counter is
// atomic — see docs/generation-id.md for why counting documents is unsafe.
export const reserveSequentialId = async (
  tx: Transaction,
  { counterKey, prefix, padding = SEQUENTIAL_ID_PADDING }: SequentialIdOptions,
): Promise<string> => {
  const counterRef = doc(db, COUNTERS_COLLECTION, counterKey);
  const snap = await tx.get(counterRef);
  const nextNumber = (snap.data()?.nextNumber as number | undefined) ?? 1;

  // set(..., merge) rather than update() so the very first create seeds the counter
  // document instead of failing on a missing document.
  tx.set(counterRef, { nextNumber: nextNumber + 1 }, { merge: true });

  return formatSequentialId(prefix, nextNumber, padding);
};

// Creates `collectionName/{generatedCode}` with the generated code as the document ID,
// allocating that code atomically. Returns the new document's ID.
export const createWithSequentialId = async (
  collectionName: string,
  data: Record<string, unknown>,
  options: SequentialIdOptions,
): Promise<string> =>
  runTransaction(db, async (tx) => {
    const id = await reserveSequentialId(tx, options);
    // All reads in a transaction must precede all writes; reserveSequentialId does
    // its read first, so this write is safely last.
    tx.set(doc(db, collectionName, id), { ...data, docId: id });
    return id;
  });

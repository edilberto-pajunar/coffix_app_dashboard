import { db } from "@/app/lib/firebase";
import { collection, onSnapshot, orderBy, query, Unsubscribe } from "firebase/firestore";
import { Transaction } from "../interface/transaction";
import { Order } from "../interface/order";

export const TransactionService = {
  listenToTransactions: (onUpdate: (items: Transaction[]) => void): Unsubscribe =>
    onSnapshot(
      query(collection(db, "transactions"), orderBy("createdAt", "desc")),
      (snap) => onUpdate(snap.docs.map((d) => ({ ...d.data(), docId: d.id }) as Transaction))
    ),

  listenToOrders: (onUpdate: (items: Order[]) => void): Unsubscribe =>
    onSnapshot(
      query(collection(db, "orders"), orderBy("createdAt", "desc")),
      (snap) => onUpdate(snap.docs.map((d) => ({ ...d.data(), docId: d.id }) as Order))
    ),
};

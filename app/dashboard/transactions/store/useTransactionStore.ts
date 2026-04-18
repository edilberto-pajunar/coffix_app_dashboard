import { create } from "zustand";
import { Transaction } from "../interface/transaction";
import { Order } from "../interface/order";
import { TransactionService } from "../service/TransactionService";

interface TransactionState {
  transactions: Transaction[];
  orders: Order[];
  listenToTransactions: () => () => void;
  listenToOrders: () => () => void;
}

export const useTransactionStore = create<TransactionState>((set) => ({
  transactions: [],
  orders: [],
  listenToTransactions: () =>
    TransactionService.listenToTransactions((transactions) => set({ transactions })),
  listenToOrders: () =>
    TransactionService.listenToOrders((orders) => set({ orders })),
}));

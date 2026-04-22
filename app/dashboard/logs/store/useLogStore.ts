import { create } from "zustand";
import { Log } from "../interface/log";
import { LogService } from "../service/LogService";

interface LogState {
  logs: Log[];
  listenToLogs: () => () => void;
}

export const useLogStore = create<LogState>((set) => ({
  logs: [],
  listenToLogs: () => LogService.listenToLogs((logs) => set({ logs })),
}));

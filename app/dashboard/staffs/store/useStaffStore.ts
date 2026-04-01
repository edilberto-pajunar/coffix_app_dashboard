import { create } from "zustand";
import { Staff } from "../interface/staff";
import { StaffService } from "../service/StaffService";

interface StaffState {
  staffs: Staff[];
  listenToStaffs: () => () => void;
}

export const useStaffStore = create<StaffState>((set) => ({
  staffs: [],
  listenToStaffs: () => StaffService.listenToStaffs((staffs) => set({ staffs })),
}));

import { create } from "zustand";
import { AppUser } from "../interface/user";
import { UserService } from "../service/UserService";

interface UserState {
  users: AppUser[];
  listenToUsers: () => () => void;
}

export const useUserStore = create<UserState>((set) => ({
  users: [],
  listenToUsers: () => UserService.listenToUsers((users) => set({ users })),
}));

import { create } from "zustand";
import { Referral } from "../interface/referral";
import { ReferralService } from "../service/ReferralService";

interface ReferralState {
  referrals: Referral[];
  listenToReferrals: () => () => void;
}

export const useReferralStore = create<ReferralState>((set) => ({
  referrals: [],
  listenToReferrals: () => ReferralService.listenToReferrals((referrals) => set({ referrals })),
}));

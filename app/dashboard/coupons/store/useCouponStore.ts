import { create } from "zustand";
import { CouponService } from "../service/CouponService";
import { Coupon } from "../interface/coupon";

interface CouponState {
  coupons: Coupon[];
  listenToCoupons: () => () => void;
}

export const useCouponStore = create<CouponState>((set) => ({
  coupons: [],
  listenToCoupons: () =>
    CouponService.listenToCoupons((coupons) => set({ coupons })),
}));

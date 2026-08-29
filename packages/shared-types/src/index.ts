// Domain types shared across user-app, restaurant-app, and admin.
//
// `database.ts` (Supabase-generated row/insert/update types for every table
// in supabase/migrations/) is produced by:
//
//   pnpm types:generate
//
// Do not hand-edit it — regenerate after any migration change.
export * from "./database";

export type ShopStatus = "pending" | "active" | "suspended";
export type OfferStatus = "draft" | "active" | "paused" | "expired";
export type DiscountType = "percentage" | "fixed" | "bogo";
export type RedemptionStatus = "pending" | "verified" | "expired" | "cancelled";
export type StaffRole = "owner" | "manager" | "staff";

export interface Offer {
  id: string;
  shopId: string;
  title: string;
  description: string | null;
  terms: string | null;
  discountType: DiscountType;
  discountValue: number;
  imageUrl: string | null;
  startAt: string;
  endAt: string;
  perUserLimit: number;
  totalLimit: number | null;
  status: OfferStatus;
}

export interface RedemptionToken {
  redemptionId: string;
  offerId: string;
  shopId: string;
  token: string;
  expiresAt: string;
}

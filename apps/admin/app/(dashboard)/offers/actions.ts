"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export interface OfferInput {
  shopId: string;
  title: string;
  description: string;
  terms: string;
  discountType: "percentage" | "fixed" | "bogo";
  discountValue: number;
  minimumOrderValue: number;
  perUserLimit: number;
  totalLimit: number | null;
  startAt: string; // ISO
  endAt: string; // ISO
  status: "draft" | "active" | "paused" | "expired";
  daysOfWeek: number[]; // 0=Sunday..6=Saturday; [] = every day
}

// Gated by RLS policy `offers_admin_write` (shops.manage) — same permission
// that gates shops writes, since an offer only makes sense attached to a
// shop. See supabase/migrations/0001_init.sql.

export async function createOffer(input: OfferInput) {
  const supabase = await createClient();
  const { error } = await supabase.from("offers").insert({
    shop_id: input.shopId,
    title: input.title,
    description: input.description || null,
    terms: input.terms || null,
    discount_type: input.discountType,
    discount_value: input.discountValue,
    minimum_order_value: input.minimumOrderValue,
    per_user_limit: input.perUserLimit,
    total_limit: input.totalLimit,
    start_at: input.startAt,
    end_at: input.endAt,
    status: input.status,
    days_of_week: input.daysOfWeek,
  });
  revalidatePath("/offers");
  return { error: error?.message ?? null };
}

export async function updateOffer(id: string, input: OfferInput) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("offers")
    .update({
      shop_id: input.shopId,
      title: input.title,
      description: input.description || null,
      terms: input.terms || null,
      discount_type: input.discountType,
      discount_value: input.discountValue,
      minimum_order_value: input.minimumOrderValue,
      per_user_limit: input.perUserLimit,
      total_limit: input.totalLimit,
      start_at: input.startAt,
      end_at: input.endAt,
      status: input.status,
      days_of_week: input.daysOfWeek,
    })
    .eq("id", id);
  revalidatePath("/offers");
  return { error: error?.message ?? null };
}

export async function deleteOffer(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("offers").delete().eq("id", id);
  revalidatePath("/offers");
  return { error: error?.message ?? null };
}

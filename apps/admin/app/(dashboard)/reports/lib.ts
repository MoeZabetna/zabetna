import { createClient } from "@/lib/supabase/server";

// Shared read layer for both report pages. Both query the
// `verified_redemptions` view (see supabase/migrations/0014_*) instead of
// `redemptions` directly — it's already scoped to status='verified' and
// carries the fee that was locked in at redemption time, plus the
// Beirut-local day/hour breakdown the Daily Performance report needs.
// The view is `security_invoker`, so it's gated by the exact same RLS
// (reports.view) as `redemptions` itself — nothing extra to configure.

export interface ReportFilters {
  categoryId?: string;
  shopId?: string;
  city?: string;
}

export function parseReportFilters(params: { [key: string]: string | string[] | undefined }): ReportFilters {
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || undefined;
  return {
    categoryId: one(params.category),
    shopId: one(params.shop),
    city: one(params.city),
  };
}

export interface FilterOptions {
  categories: { id: string; name: string }[];
  shops: { id: string; name: string }[];
  cities: string[];
}

export async function getFilterOptions(): Promise<FilterOptions> {
  const supabase = await createClient();
  const [{ data: categories }, { data: shops }, { data: cityRows }] = await Promise.all([
    supabase.from("categories").select("id, name").order("sort_order", { ascending: true }),
    supabase.from("shops").select("id, name").order("name", { ascending: true }),
    supabase.from("shops").select("city").order("city", { ascending: true }),
  ]);
  const cities = Array.from(new Set((cityRows ?? []).map((r) => r.city))).sort();
  return { categories: categories ?? [], shops: shops ?? [], cities };
}

export interface VerifiedRedemptionRow {
  id: string;
  shop_id: string;
  fee_amount_usd: number | null;
  dow_beirut: number | null;
  hour_beirut: number | null;
}

/**
 * Fetches verified_redemptions rows matching the given filters. Selects
 * only what each report needs — callers pass which columns they want
 * beyond the always-included shop_id/fee_amount_usd.
 */
export async function getVerifiedRedemptions(
  filters: ReportFilters,
  extraColumns: string[] = []
): Promise<VerifiedRedemptionRow[]> {
  const supabase = await createClient();
  let query = supabase
    .from("verified_redemptions")
    .select(["id", "shop_id", "fee_amount_usd", ...extraColumns].join(", "));

  if (filters.categoryId) query = query.eq("category_id", filters.categoryId);
  if (filters.shopId) query = query.eq("shop_id", filters.shopId);
  if (filters.city) query = query.eq("city", filters.city);

  const { data } = await query;
  return (data ?? []) as unknown as VerifiedRedemptionRow[];
}

export function formatUsd(amount: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount);
}

export const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]; // 0=Sunday..6=Saturday, matches offers.days_of_week

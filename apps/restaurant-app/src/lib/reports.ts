import type { SupabaseClient } from "@supabase/supabase-js";

// Both report queries read `verified_redemptions` (see
// supabase/migrations/0014_verified_redemptions_view.sql) exactly the way
// the admin panel's Reports pages do (apps/admin/app/(dashboard)/reports/
// lib.ts) — status='verified' only, fee_amount_usd locked at redemption
// time, Beirut-local timestamp precomputed. The view is security_invoker,
// and RLS's redemptions_staff_scope policy (shop_id = staff_shop_id())
// means a shop_staff query here is automatically scoped to their own shop
// with no explicit shop_id filter needed — the view's own comment calls
// this out as its intended use by "the future vendor/shops app", which is
// this app.

interface RawRow {
  id: string;
  fee_amount_usd: number | null;
  verified_at_beirut: string | null;
}

export interface RangeReport {
  count: number;
  totalUsd: number;
  rows: { id: string; verifiedAtBeirut: string; feeUsd: number }[];
}

function toDateOnly(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Invoice-ready range report: count + total owed for verified redemptions
 * between two calendar dates (inclusive of both ends).
 */
export async function fetchRangeReport(client: SupabaseClient, from: Date, to: Date): Promise<RangeReport> {
  const fromStr = `${toDateOnly(from)}T00:00:00`;
  const toExclusive = new Date(to);
  toExclusive.setDate(toExclusive.getDate() + 1);
  const toStr = `${toDateOnly(toExclusive)}T00:00:00`;

  const { data, error } = await client
    .from("verified_redemptions")
    .select("id, fee_amount_usd, verified_at_beirut")
    .gte("verified_at_beirut", fromStr)
    .lt("verified_at_beirut", toStr)
    .order("verified_at_beirut", { ascending: false });

  if (error) throw error;

  const rows = (data ?? []) as RawRow[];
  return {
    count: rows.length,
    totalUsd: rows.reduce((sum, r) => sum + (r.fee_amount_usd ?? 0), 0),
    rows: rows.map((r) => ({ id: r.id, verifiedAtBeirut: r.verified_at_beirut ?? "", feeUsd: r.fee_amount_usd ?? 0 })),
  };
}

export interface MonthlyBucket {
  month: string; // "YYYY-MM"
  count: number;
  totalUsd: number;
}

/**
 * Monthly redemptions report, bucketed client-side by the "YYYY-MM" prefix
 * of the precomputed Beirut-local timestamp. Bounded to the trailing
 * `monthsBack` months (default 12) — a single shop's redemption volume
 * should stay well within what's reasonable to pull in one query, but an
 * unbounded "all time" fetch isn't a good default as the shop's history
 * grows.
 */
export async function fetchMonthlyReport(client: SupabaseClient, monthsBack = 12): Promise<MonthlyBucket[]> {
  const since = new Date();
  since.setDate(1);
  since.setMonth(since.getMonth() - (monthsBack - 1));
  const sinceStr = `${toDateOnly(since)}T00:00:00`;

  const { data, error } = await client
    .from("verified_redemptions")
    .select("id, fee_amount_usd, verified_at_beirut")
    .gte("verified_at_beirut", sinceStr)
    .order("verified_at_beirut", { ascending: false });

  if (error) throw error;

  const rows = (data ?? []) as RawRow[];
  const byMonth = new Map<string, MonthlyBucket>();
  for (const r of rows) {
    if (!r.verified_at_beirut) continue;
    const month = r.verified_at_beirut.slice(0, 7);
    const bucket = byMonth.get(month) ?? { month, count: 0, totalUsd: 0 };
    bucket.count += 1;
    bucket.totalUsd += r.fee_amount_usd ?? 0;
    byMonth.set(month, bucket);
  }
  return Array.from(byMonth.values()).sort((a, b) => (a.month < b.month ? 1 : -1));
}

export function formatUsd(amount: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount);
}

export function formatMonthLabel(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

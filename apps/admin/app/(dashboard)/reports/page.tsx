import { createClient } from "@/lib/supabase/server";
import { getCurrentAdmin, hasPermission } from "@/lib/auth/current-admin";
import { getFilterOptions, getVerifiedRedemptions, parseReportFilters, formatUsd } from "./lib";
import { FilterBar } from "./FilterBar";
import { ReportTabs } from "./ReportTabs";
import { SortLink } from "./SortLink";

interface ShopRow {
  id: string;
  name: string;
  city: string;
  value_per_redemption: number | null;
  categories: { name: string } | { name: string }[] | null;
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const admin = await getCurrentAdmin();

  if (!hasPermission(admin, "reports.view")) {
    return (
      <div>
        <h1 className="text-xl font-semibold text-neutral-900">Reports</h1>
        <p className="mt-2 text-sm text-neutral-500">Your role doesn&apos;t have permission to view reports.</p>
      </div>
    );
  }

  const filters = parseReportFilters(params);
  const sort = (Array.isArray(params.sort) ? params.sort[0] : params.sort) === "name" ? "name" : "quantity";
  const dir = (Array.isArray(params.dir) ? params.dir[0] : params.dir) === "asc" ? "asc" : "desc";
  const queryString = new URLSearchParams(
    Object.entries(params).flatMap(([k, v]) => (v == null ? [] : [[k, Array.isArray(v) ? v[0] : v] as [string, string]]))
  ).toString();

  const supabase = await createClient();
  const [options, redemptions, shopsResult] = await Promise.all([
    getFilterOptions(),
    getVerifiedRedemptions(filters),
    (() => {
      let q = supabase
        .from("shops")
        .select("id, name, city, value_per_redemption, categories(name)");
      if (filters.categoryId) q = q.eq("category_id", filters.categoryId);
      if (filters.shopId) q = q.eq("id", filters.shopId);
      if (filters.city) q = q.eq("city", filters.city);
      return q;
    })(),
  ]);

  const shops = (shopsResult.data ?? []) as ShopRow[];

  // count + true locked-fee total per shop — NOT current_fee * count, since
  // a shop's rate can change over the reporting window and fee_amount_usd
  // is what was actually locked in on each redemption at the time it
  // happened (see 0012_redemption_fee_and_city.sql). If a shop's rate
  // never changed, this total will equal current_fee * count exactly.
  const statsByShop = redemptions.reduce<Record<string, { count: number; total: number }>>((acc, r) => {
    const s = (acc[r.shop_id] ??= { count: 0, total: 0 });
    s.count += 1;
    s.total += r.fee_amount_usd ?? 0;
    return acc;
  }, {});

  let rows = shops.map((shop) => {
    const cat = Array.isArray(shop.categories) ? shop.categories[0] : shop.categories;
    const stats = statsByShop[shop.id] ?? { count: 0, total: 0 };
    return {
      id: shop.id,
      name: shop.name,
      city: shop.city,
      category: cat?.name ?? "—",
      fee: shop.value_per_redemption,
      count: stats.count,
      total: stats.total,
      // true only when the shop's current rate matches every locked fee in
      // this window — surfaced so a mismatch isn't silently invisible.
      rateChangedDuringWindow: stats.count > 0 && shop.value_per_redemption != null && Math.abs(stats.total - shop.value_per_redemption * stats.count) > 0.005,
    };
  });

  rows =
    sort === "name"
      ? rows.sort((a, b) => (dir === "asc" ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name)))
      : rows.sort((a, b) => (dir === "asc" ? a.count - b.count : b.count - a.count));

  const totals = rows.reduce(
    (acc, r) => ({ count: acc.count + r.count, total: acc.total + r.total }),
    { count: 0, total: 0 }
  );

  return (
    <div>
      <div className="mb-2">
        <h1 className="text-xl font-semibold text-neutral-900">Reports</h1>
        <p className="text-sm text-neutral-500">
          Verified redemptions only — pending, expired, and cancelled redemptions never happened at the shop and
          aren&apos;t counted or billed.
        </p>
      </div>

      <ReportTabs active="overall" queryString={queryString} />
      <FilterBar options={options} />

      <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-neutral-50 text-xs uppercase tracking-wide text-neutral-500">
            <tr>
              <th className="px-4 py-2 font-medium">
                <SortLink label="Shop" sortKey="name" currentSort={sort} currentDir={dir} queryString={queryString} />
              </th>
              <th className="px-4 py-2 font-medium">City</th>
              <th className="px-4 py-2 font-medium">Category</th>
              <th className="px-4 py-2 font-medium text-right">
                <SortLink
                  label="Redemptions"
                  sortKey="quantity"
                  currentSort={sort}
                  currentDir={dir}
                  queryString={queryString}
                />
              </th>
              <th className="px-4 py-2 font-medium text-right">Redemption fee</th>
              <th className="px-4 py-2 font-medium text-right">Total value</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-neutral-500">
                  No shops match these filters.
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-neutral-100">
                <td className="px-4 py-3 font-medium text-neutral-900">{r.name}</td>
                <td className="px-4 py-3 text-neutral-600">{r.city}</td>
                <td className="px-4 py-3 text-neutral-600">{r.category}</td>
                <td className="px-4 py-3 text-right tabular-nums text-neutral-900">{r.count}</td>
                <td className="px-4 py-3 text-right tabular-nums text-neutral-600">
                  {r.fee != null ? formatUsd(r.fee) : <span className="text-neutral-400">Not set</span>}
                </td>
                <td className="px-4 py-3 text-right tabular-nums font-medium text-neutral-900">
                  {formatUsd(r.total)}
                  {r.rateChangedDuringWindow && (
                    <span
                      className="ml-1 text-amber-600"
                      title="This shop's rate changed during the selected period — total reflects the fee actually locked in on each redemption, not the current rate × count."
                    >
                      *
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
          {rows.length > 0 && (
            <tfoot>
              <tr className="border-t border-neutral-200 bg-neutral-50 font-medium text-neutral-900">
                <td className="px-4 py-3" colSpan={3}>
                  Total
                </td>
                <td className="px-4 py-3 text-right tabular-nums">{totals.count}</td>
                <td className="px-4 py-3" />
                <td className="px-4 py-3 text-right tabular-nums">{formatUsd(totals.total)}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}

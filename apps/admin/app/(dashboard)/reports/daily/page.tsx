import { getCurrentAdmin, hasPermission } from "@/lib/auth/current-admin";
import { getFilterOptions, getVerifiedRedemptions, parseReportFilters, formatUsd, DAY_LABELS } from "../lib";
import { FilterBar } from "../FilterBar";
import { ReportTabs } from "../ReportTabs";

interface Cell {
  count: number;
  total: number;
}

export default async function DailyPerformancePage({
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
  const queryString = new URLSearchParams(
    Object.entries(params).flatMap(([k, v]) => (v == null ? [] : [[k, Array.isArray(v) ? v[0] : v] as [string, string]]))
  ).toString();

  const [options, redemptions] = await Promise.all([
    getFilterOptions(),
    getVerifiedRedemptions(filters, ["dow_beirut", "hour_beirut"]),
  ]);

  // 24 hours x 7 days (0=Sunday..6=Saturday, same convention as
  // offers.days_of_week), bucketed on verified_at in Asia/Beirut local
  // time (precomputed by the verified_redemptions view) so a redemption
  // just after midnight Beirut time lands on the correct calendar day —
  // bucketing on raw UTC would misfile anything within ~3 hours of
  // midnight Beirut time onto the wrong day.
  const grid: Cell[][] = Array.from({ length: 24 }, () => Array.from({ length: 7 }, () => ({ count: 0, total: 0 })));

  for (const r of redemptions as unknown as { dow_beirut: number | null; hour_beirut: number | null; fee_amount_usd: number | null }[]) {
    if (r.dow_beirut == null || r.hour_beirut == null) continue;
    const cell = grid[r.hour_beirut][r.dow_beirut];
    cell.count += 1;
    cell.total += r.fee_amount_usd ?? 0;
  }

  const maxCount = Math.max(1, ...grid.flat().map((c) => c.count));
  const hourTotals = grid.map((row) => row.reduce((acc, c) => ({ count: acc.count + c.count, total: acc.total + c.total }), { count: 0, total: 0 }));
  const dayTotals = Array.from({ length: 7 }, (_, d) =>
    grid.reduce((acc, row) => ({ count: acc.count + row[d].count, total: acc.total + row[d].total }), { count: 0, total: 0 })
  );
  const grandTotal = dayTotals.reduce((acc, d) => ({ count: acc.count + d.count, total: acc.total + d.total }), { count: 0, total: 0 });

  function cellStyle(count: number) {
    if (count === 0) return { backgroundColor: "transparent" };
    const intensity = 0.12 + 0.75 * (count / maxCount);
    return { backgroundColor: `rgba(23, 23, 23, ${intensity})` };
  }

  return (
    <div>
      <div className="mb-2">
        <h1 className="text-xl font-semibold text-neutral-900">Reports</h1>
        <p className="text-sm text-neutral-500">
          Verified redemptions by day of week and hour of day, Beirut local time. Darker cells = more redemptions.
        </p>
      </div>

      <ReportTabs active="daily" queryString={queryString} />
      <FilterBar options={options} />

      {grandTotal.count === 0 ? (
        <div className="rounded-lg border border-neutral-200 bg-white px-4 py-6 text-center text-sm text-neutral-500">
          No verified redemptions match these filters.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-white">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="text-neutral-500">
                <th className="sticky left-0 bg-white px-2 py-1.5 text-right font-medium">Hour</th>
                {DAY_LABELS.map((d) => (
                  <th key={d} className="px-2 py-1.5 text-center font-medium">
                    {d}
                  </th>
                ))}
                <th className="px-2 py-1.5 text-right font-medium">Total</th>
              </tr>
            </thead>
            <tbody>
              {grid.map((row, hour) => (
                <tr key={hour} className="border-t border-neutral-100">
                  <td className="sticky left-0 bg-white px-2 py-1 text-right tabular-nums text-neutral-500">
                    {hour.toString().padStart(2, "0")}:00
                  </td>
                  {row.map((cell, day) => (
                    <td key={day} style={cellStyle(cell.count)} className="px-2 py-1 text-center tabular-nums" title={cell.count > 0 ? `${cell.count} redemption(s) · ${formatUsd(cell.total)}` : "No redemptions"}>
                      {cell.count > 0 ? (
                        <span className={cell.count / maxCount > 0.5 ? "text-white" : "text-neutral-900"}>{cell.count}</span>
                      ) : (
                        <span className="text-neutral-200">·</span>
                      )}
                    </td>
                  ))}
                  <td className="px-2 py-1 text-right tabular-nums font-medium text-neutral-700">{hourTotals[hour].count || ""}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-neutral-200 bg-neutral-50 font-medium text-neutral-900">
                <td className="sticky left-0 bg-neutral-50 px-2 py-1.5 text-right">Total</td>
                {dayTotals.map((d, i) => (
                  <td key={i} className="px-2 py-1.5 text-center tabular-nums">
                    {d.count || ""}
                  </td>
                ))}
                <td className="px-2 py-1.5 text-right tabular-nums">{grandTotal.count}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {grandTotal.count > 0 && (
        <div className="mt-3 flex gap-6 text-sm text-neutral-600">
          <div>
            Total redemptions: <span className="font-medium text-neutral-900">{grandTotal.count}</span>
          </div>
          <div>
            Total value: <span className="font-medium text-neutral-900">{formatUsd(grandTotal.total)}</span>
          </div>
        </div>
      )}
    </div>
  );
}

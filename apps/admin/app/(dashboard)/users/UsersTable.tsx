"use client";

import { useState } from "react";
import { Search } from "lucide-react";
import { formatUsd, formatDate } from "@/lib/format";

export interface UserPointsRow {
  user_id: string;
  full_name: string | null;
  phone: string | null;
  gender: "male" | "female" | "prefer_not_to_say" | null;
  date_of_birth: string | null;
  registered_at: string;
  redemption_count: number;
  points_earned: number;
  points_claimed: number;
  points_available: number;
  available_usd: number;
  lifetime_paid_usd: number;
}

const GENDER_LABEL: Record<string, string> = {
  male: "Male",
  female: "Female",
  prefer_not_to_say: "Prefer not to say",
};

// Mobile numbers in the data may or may not include spaces/dashes/a "+" —
// strip everything but digits on both sides so "+961 3 123 456" matches a
// search for "3123456" or "961-3-123-456" either way.
function digitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}

export function UsersTable({ rows }: { rows: UserPointsRow[] }) {
  const [search, setSearch] = useState("");

  const query = search.trim().toLowerCase();
  const queryDigits = digitsOnly(search);
  const visibleRows = query
    ? rows.filter((r) => {
        const nameMatch = (r.full_name ?? "").toLowerCase().includes(query);
        const phoneMatch = queryDigits.length > 0 && digitsOnly(r.phone ?? "").includes(queryDigits);
        return nameMatch || phoneMatch;
      })
    : rows;

  const totals = visibleRows.reduce(
    (acc, r) => ({
      redemptions: acc.redemptions + r.redemption_count,
      pointsEarned: acc.pointsEarned + r.points_earned,
    }),
    { redemptions: 0, pointsEarned: 0 }
  );

  return (
    <div>
      <div className="mb-4 relative w-full max-w-xs">
        <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or mobile number…"
          className="w-full rounded-md border border-neutral-300 py-2 pl-8 pr-3 text-sm outline-none focus:border-neutral-900"
        />
      </div>

      <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-neutral-50 text-xs uppercase tracking-wide text-neutral-500">
            <tr>
              <th className="px-4 py-2 font-medium">User</th>
              <th className="px-4 py-2 font-medium">Registered</th>
              <th className="px-4 py-2 font-medium">Mobile</th>
              <th className="px-4 py-2 font-medium">Gender</th>
              <th className="px-4 py-2 font-medium">Date of birth</th>
              <th className="px-4 py-2 font-medium text-right">Redemptions</th>
              <th className="px-4 py-2 font-medium text-right">Points earned</th>
              <th className="px-4 py-2 font-medium text-right">Value (USD)</th>
              <th className="px-4 py-2 font-medium text-right">Available balance</th>
            </tr>
          </thead>
          <tbody>
            {visibleRows.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-6 text-center text-neutral-500">
                  {query ? `No users match "${search.trim()}".` : "No registered users yet."}
                </td>
              </tr>
            )}
            {visibleRows.map((r) => (
              <tr key={r.user_id} className="border-t border-neutral-100">
                <td className="px-4 py-3 font-medium text-neutral-900">{r.full_name ?? "—"}</td>
                <td className="px-4 py-3 text-neutral-600">{formatDate(r.registered_at)}</td>
                <td className="px-4 py-3 text-neutral-600">{r.phone ?? "—"}</td>
                <td className="px-4 py-3 text-neutral-600">{r.gender ? GENDER_LABEL[r.gender] : "—"}</td>
                <td className="px-4 py-3 text-neutral-600">
                  {r.date_of_birth ? formatDate(r.date_of_birth) : "—"}
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-neutral-900">{r.redemption_count}</td>
                <td className="px-4 py-3 text-right tabular-nums text-neutral-900">{r.points_earned}</td>
                <td className="px-4 py-3 text-right tabular-nums text-neutral-600">
                  {formatUsd(r.points_earned * 0.25)}
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-neutral-600">
                  {r.points_available} pts
                  <span className="ml-1 text-neutral-400">({formatUsd(r.available_usd)})</span>
                </td>
              </tr>
            ))}
          </tbody>
          {visibleRows.length > 0 && (
            <tfoot>
              <tr className="border-t border-neutral-200 bg-neutral-50 font-medium text-neutral-900">
                <td className="px-4 py-3" colSpan={5}>
                  {query ? "Total (matching)" : "Total"}
                </td>
                <td className="px-4 py-3 text-right tabular-nums">{totals.redemptions}</td>
                <td className="px-4 py-3 text-right tabular-nums">{totals.pointsEarned}</td>
                <td className="px-4 py-3 text-right tabular-nums">{formatUsd(totals.pointsEarned * 0.25)}</td>
                <td className="px-4 py-3" />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}

import { createClient } from "@/lib/supabase/server";
import { getCurrentAdmin, hasPermission } from "@/lib/auth/current-admin";
import { formatUsd, formatDate } from "@/lib/format";

interface UserPointsRow {
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

export default async function UsersPage() {
  const admin = await getCurrentAdmin();

  if (!hasPermission(admin, "users.view")) {
    return (
      <div>
        <h1 className="text-xl font-semibold text-neutral-900">Users</h1>
        <p className="mt-2 text-sm text-neutral-500">Your role doesn&apos;t have permission to view users.</p>
      </div>
    );
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("user_points_summary")
    .select(
      "user_id, full_name, phone, gender, date_of_birth, registered_at, redemption_count, points_earned, points_claimed, points_available, available_usd, lifetime_paid_usd"
    )
    .order("registered_at", { ascending: false });

  const rows = (data ?? []) as UserPointsRow[];

  const totals = rows.reduce(
    (acc, r) => ({
      redemptions: acc.redemptions + r.redemption_count,
      pointsEarned: acc.pointsEarned + r.points_earned,
    }),
    { redemptions: 0, pointsEarned: 0 }
  );

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-neutral-900">Users</h1>
        <p className="text-sm text-neutral-500">
          Registered app users. Points are earned 1-per-verified-redemption at $0.25/point — see the{" "}
          <a href="/rewards" className="text-neutral-900 underline">
            Reward Program
          </a>{" "}
          tab for cash-out requests.
        </p>
      </div>

      {error && (
        <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          Couldn&apos;t load users: {error.message}
        </p>
      )}

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
            {rows.length === 0 && !error && (
              <tr>
                <td colSpan={9} className="px-4 py-6 text-center text-neutral-500">
                  No registered users yet.
                </td>
              </tr>
            )}
            {rows.map((r) => (
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
          {rows.length > 0 && (
            <tfoot>
              <tr className="border-t border-neutral-200 bg-neutral-50 font-medium text-neutral-900">
                <td className="px-4 py-3" colSpan={5}>
                  Total
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

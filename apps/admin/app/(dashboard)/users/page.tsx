import { createClient } from "@/lib/supabase/server";
import { getCurrentAdmin, hasPermission } from "@/lib/auth/current-admin";
import { UsersTable, type UserPointsRow } from "./UsersTable";

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

      <UsersTable rows={rows} />
    </div>
  );
}

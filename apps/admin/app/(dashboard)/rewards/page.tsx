import { createClient } from "@/lib/supabase/server";
import { getCurrentAdmin, hasPermission } from "@/lib/auth/current-admin";
import { RewardsManager, type RewardRequestRow } from "./RewardsManager";

const STATUS_TABS = ["pending", "confirmed", "rejected", "all"] as const;
type StatusTab = (typeof STATUS_TABS)[number];

export default async function RewardsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const admin = await getCurrentAdmin();

  if (!hasPermission(admin, "users.view")) {
    return (
      <div>
        <h1 className="text-xl font-semibold text-neutral-900">Reward Program</h1>
        <p className="mt-2 text-sm text-neutral-500">Your role doesn&apos;t have permission to view this.</p>
      </div>
    );
  }

  const activeTab: StatusTab = STATUS_TABS.includes(status as StatusTab) ? (status as StatusTab) : "pending";

  const supabase = await createClient();
  let query = supabase
    .from("reward_redemption_requests")
    .select(
      "id, user_id, points_requested, usd_amount, service_fee_usd, net_usd_amount, phone_number, status, requested_at, processed_at, admin_note, profiles(full_name)"
    )
    .order("requested_at", { ascending: false });

  if (activeTab !== "all") query = query.eq("status", activeTab);

  const { data, error } = await query;
  const rows = (data ?? []) as unknown as RewardRequestRow[];

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-neutral-900">Reward Program</h1>
        <p className="text-sm text-neutral-500">
          Cash-out requests against a user&apos;s point balance ($0.25/point, 40-point / $10.00 minimum), less a
          $1.00 service fee per request. <strong className="font-semibold text-neutral-900">Transfer the
          &quot;Send this amount&quot; column, not the points value</strong> — the fee is withheld, so a 40-point
          request is a $9.00 transfer. Pressing &quot;Redeem&quot; in the app sweeps the user&apos;s full available
          balance — see{" "}
          <a href="/users" className="text-neutral-900 underline">
            Users
          </a>{" "}
          for running balances. Confirming here only records that the Wish Money transfer to the listed number was
          already sent — it does not send money.
        </p>
      </div>

      {error && (
        <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          Couldn&apos;t load requests: {error.message}
        </p>
      )}

      <div className="mb-4 flex gap-1 border-b border-neutral-200">
        {STATUS_TABS.map((tab) => (
          <a
            key={tab}
            href={`/rewards?status=${tab}`}
            className={`border-b-2 px-3 py-2 text-sm font-medium capitalize ${
              activeTab === tab
                ? "border-neutral-900 text-neutral-900"
                : "border-transparent text-neutral-500 hover:text-neutral-900"
            }`}
          >
            {tab}
          </a>
        ))}
      </div>

      <RewardsManager initialRows={rows} canManage={hasPermission(admin, "rewards.manage")} />
    </div>
  );
}

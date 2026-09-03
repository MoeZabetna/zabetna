import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Rewards / points data layer for the User App.
 *
 * Everything money-affecting here is deliberately thin: the balance comes
 * from a view the database computes, and the payout request sends *no*
 * amount at all. `set_reward_request_amounts()` (a BEFORE INSERT trigger,
 * supabase/migrations/0016_rewards_program.sql) overwrites
 * `points_requested` / `usd_amount` / `phone_number` on every insert
 * regardless of the payload, so any amount sent from here would be
 * ignored — sending one anyway would only create the illusion that the
 * client decides the payout. See docs/rewards-program.md.
 *
 * This lives in the app rather than in packages/api-client because only
 * the User App requests payouts — the same reason the Restaurant App keeps
 * its staff-session logic in src/lib/session.ts.
 */

/** 1 point = $0.25 USD. Mirrors the rate hardcoded in the insert trigger. */
export const USD_PER_POINT = 0.25;

/**
 * Minimum balance the server will accept a payout request for. The trigger
 * rejects anything below this outright; the UI checks it too so the user is
 * told *before* pressing a button that would fail.
 */
export const MIN_POINTS = 40;

/**
 * Flat service fee withheld from every payout, in USD.
 *
 * Mirrors the value locked by `set_reward_request_amounts()`; it is here so
 * the UI can show the breakdown *before* submitting. The authoritative
 * figure is always the `service_fee_usd` stored on the request itself — a
 * past payout must keep saying what it actually charged even if this
 * constant changes.
 *
 * The first payout's fee also covers OTP verification. Users are never
 * charged twice (Mo, 2026-09-03).
 */
export const SERVICE_FEE_USD = 1.0;

export type PointsBalance = {
  fullName: string | null;
  /** Null until the current number is OTP-verified. Payouts are refused without it. */
  phoneVerifiedAt: string | null;
  pointsAvailable: number;
  availableUsd: number;
  pointsEarned: number;
  redemptionCount: number;
  /** From `profiles.phone`. Empty/null means no payout can be requested. */
  phone: string | null;
};

export type BalanceResult =
  | { status: "ok"; userId: string; balance: PointsBalance; verificationRequired: boolean }
  | { status: "signed-out" }
  | { status: "error"; message: string };

/**
 * Reads the signed-in user's own row from `public.user_points_summary`.
 *
 * The view is `security_invoker = true` and already granted to
 * `authenticated`, so RLS scopes it to the caller's own row — no user_id
 * filter is needed or trusted here. `maybeSingle()` rather than `single()`
 * because a brand-new account with no redemptions may legitimately have no
 * row yet, which is a zero balance rather than an error.
 */
export async function fetchPointsBalance(client: SupabaseClient): Promise<BalanceResult> {
  const { data: sessionData } = await client.auth.getSession();
  if (!sessionData.session) return { status: "signed-out" };

  const { data, error } = await client
    .from("user_points_summary")
    .select(
      "full_name, points_available, available_usd, points_earned, redemption_count, phone, phone_verified_at"
    )
    .maybeSingle();

  if (error) return { status: "error", message: error.message };

  return {
    status: "ok",
    userId: sessionData.session.user.id,
    verificationRequired: await isPhoneVerificationRequired(client),
    balance: {
      fullName: data?.full_name ?? null,
      phoneVerifiedAt: data?.phone_verified_at ?? null,
      pointsAvailable: data?.points_available ?? 0,
      availableUsd: data?.available_usd ?? 0,
      pointsEarned: data?.points_earned ?? 0,
      redemptionCount: data?.redemption_count ?? 0,
      phone: data?.phone ?? null,
    },
  };
}

export type RedeemResult =
  | { status: "submitted" }
  | { status: "rejected"; reason: string };

/**
 * Requests a payout of the user's entire available balance.
 *
 * Only `user_id` is sent. The trigger fills in the amount, the USD value
 * and the phone number from the profile, and forces `status = 'pending'`.
 * A `raise exception` in that trigger (no phone on file, balance under the
 * minimum) comes back as a Postgres error, which is surfaced verbatim
 * rather than replaced with a generic message — the trigger's own wording
 * already says which of the two rules was broken, and rewriting it here
 * would only risk telling the user something the database didn't say.
 */
export async function requestRedemption(
  client: SupabaseClient,
  userId: string
): Promise<RedeemResult> {
  const { error } = await client.from("reward_redemption_requests").insert({ user_id: userId });
  if (error) return { status: "rejected", reason: error.message };
  return { status: "submitted" };
}

export type PendingRequest = {
  id: string;
  pointsRequested: number;
  /** Gross, before the service fee. */
  usdAmount: number;
  serviceFeeUsd: number;
  /** What actually gets transferred. */
  netUsdAmount: number;
  phoneNumber: string;
  requestedAt: string;
};

/** Net payout for a given balance, after the flat service fee. */
export function netPayoutUsd(availableUsd: number): number {
  return Math.max(0, availableUsd - SERVICE_FEE_USD);
}

/**
 * The user's most recent payout request, if it is still pending.
 *
 * Worth showing on its own: while a request is pending its points are
 * *reserved*, so the balance legitimately reads 0 and the Redeem button is
 * legitimately disabled. Without this, that looks like the points vanished.
 */
export async function fetchPendingRequest(client: SupabaseClient): Promise<PendingRequest | null> {
  const { data, error } = await client
    .from("reward_redemption_requests")
    .select("id, points_requested, usd_amount, service_fee_usd, net_usd_amount, phone_number, requested_at")
    .eq("status", "pending")
    .order("requested_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;
  return {
    id: data.id,
    pointsRequested: data.points_requested,
    usdAmount: Number(data.usd_amount),
    serviceFeeUsd: Number(data.service_fee_usd),
    netUsdAmount: Number(data.net_usd_amount),
    phoneNumber: data.phone_number,
    requestedAt: data.requested_at,
  };
}

export function formatUsd(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

/**
 * Whether a payout currently requires an OTP-verified number.
 *
 * Server-configured (`app_settings.reward_phone_verification_required`), not
 * a client constant, so the app and the database can never disagree about
 * it: `set_reward_request_amounts()` reads the same flag. It is off while
 * the end-to-end flow is being tested and no SMS provider exists; flipping
 * the row turns the Verify step back on with no code change.
 *
 * Defaults to `true` if the flag can't be read — the safe failure is to ask
 * for verification, not to skip it. The server would refuse the request
 * anyway, so this only decides whether the UI explains why first.
 */
export async function isPhoneVerificationRequired(client: SupabaseClient): Promise<boolean> {
  const { data, error } = await client.rpc("reward_phone_verification_required");
  if (error || typeof data !== "boolean") return true;
  return data;
}

// ── Phone verification (payout-time OTP) ───────────────────────────────────
//
// Verification happens here rather than at signup: a user only needs a
// proven number at the moment real money is about to be sent to it, and
// making every new account pay an SMS would cost money for people who may
// never reach the payout minimum (Mo, 2026-09-03).
//
// `updateUser({ phone })` makes GoTrue send the SMS; `verifyOtp` with type
// "phone_change" confirms it and stamps `auth.users.phone_confirmed_at`.
// The profile is then updated by `sync_verified_phone()`, which reads that
// stamp from GoTrue rather than trusting anything sent from here.

export type OtpResult = { ok: true } | { ok: false; message: string };

export async function sendPhoneOtp(client: SupabaseClient, phone: string): Promise<OtpResult> {
  const { error } = await client.auth.updateUser({ phone: phone.trim() });
  if (error) return { ok: false, message: error.message };
  return { ok: true };
}

export async function confirmPhoneOtp(
  client: SupabaseClient,
  phone: string,
  code: string
): Promise<OtpResult> {
  const { error } = await client.auth.verifyOtp({
    phone: phone.trim(),
    token: code.trim(),
    type: "phone_change",
  });
  if (error) return { ok: false, message: error.message };

  // Mirror GoTrue's confirmation onto the profile. Done server-side so the
  // app cannot mark a number verified by itself.
  const { error: syncError } = await client.rpc("sync_verified_phone");
  if (syncError) return { ok: false, message: syncError.message };

  return { ok: true };
}

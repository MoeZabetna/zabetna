import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { RedemptionToken } from "@zabetna/shared-types";

/**
 * One Supabase client factory shared by all three apps. Each app passes its
 * own env vars in (Expo apps use EXPO_PUBLIC_*, the admin panel uses
 * NEXT_PUBLIC_*) — this package stays framework-agnostic.
 */
export function createZabetnaClient(url: string, anonKey: string): SupabaseClient {
  return createClient(url, anonKey, {
    auth: { persistSession: true, autoRefreshToken: true },
  });
}

/**
 * User App: request a redemption for an offer. This calls the
 * `create_redemption` edge function rather than inserting into
 * `redemptions` directly — the limit checks in supabase/functions/
 * create-redemption/ are the only place that logic should live.
 */
export async function createRedemption(
  client: SupabaseClient,
  offerId: string
): Promise<RedemptionToken> {
  const { data, error } = await client.functions.invoke("create-redemption", {
    body: { offerId },
  });
  if (error) throw error;
  return data as RedemptionToken;
}

/**
 * Restaurant App: verify a scanned token. Calls `verify_redemption`, which
 * enforces the shop match, expiry, and single-use checks described in
 * docs/blueprint.html §04 at the database layer.
 */
export async function verifyRedemption(
  client: SupabaseClient,
  token: string
): Promise<{ status: "verified"; offerTitle: string } | { status: "rejected"; reason: string }> {
  const { data, error } = await client.functions.invoke("verify-redemption", {
    body: { token },
  });
  if (error) throw error;
  return data;
}

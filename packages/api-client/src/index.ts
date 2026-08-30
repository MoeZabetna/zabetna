import { createClient, FunctionsHttpError, type SupabaseClient } from "@supabase/supabase-js";
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

export type VerifyRedemptionResult =
  | { status: "verified"; offerTitle: string }
  | { status: "rejected"; reason: string };

/**
 * Restaurant App: verify a scanned or manually-entered token. Calls
 * `verify-redemption`, which enforces the shop match, expiry, and
 * single-use checks described in docs/blueprint.html §04 at the database
 * layer.
 *
 * `verify-redemption` returns every rejection (wrong shop, already used,
 * expired, unrecognized code, not signed in) as a non-2xx HTTP status with
 * a `{status:"rejected", reason:"..."}` JSON body — that's the whole point,
 * so the Restaurant App can show staff *why* a code didn't work. The
 * Supabase client's `functions.invoke` treats any non-2xx response as a
 * `FunctionsHttpError` and discards the body from `data`, so without this
 * catch every single rejection would surface here as a generic thrown
 * error instead of the specific reason — read it back off
 * `error.context` (the raw Response) instead of losing it.
 */
export async function verifyRedemption(client: SupabaseClient, token: string): Promise<VerifyRedemptionResult> {
  const { data, error } = await client.functions.invoke("verify-redemption", {
    body: { token },
  });

  if (error) {
    // `error.context` is the raw fetch Response, typed `any` on
    // FunctionsError since this package has no DOM lib (it's shared with
    // React Native, which has no DOM lib either) — duck-type it instead of
    // `instanceof Response` so this compiles under both runtimes, which do
    // both have a real Response global at execution time.
    const context = (error as { context?: unknown }).context as { clone?: () => { json: () => Promise<unknown> } } | undefined;
    if (error instanceof FunctionsHttpError && context && typeof context.clone === "function") {
      try {
        const body = (await context.clone().json()) as { status?: string; reason?: unknown };
        if (body && body.status === "rejected" && typeof body.reason === "string") {
          return body as VerifyRedemptionResult;
        }
      } catch {
        // Body wasn't JSON (or was already consumed) — fall through to the
        // generic message below rather than pretending we parsed it.
      }
    }
    throw error;
  }

  return data as VerifyRedemptionResult;
}

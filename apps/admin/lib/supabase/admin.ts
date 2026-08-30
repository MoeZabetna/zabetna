import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@zabetna/shared-types";

/**
 * Service-role Supabase client — bypasses RLS entirely and can call the
 * Auth Admin API (auth.admin.createUser, etc). ONLY ever import this from
 * a "use server" file, and never from anything a client component could
 * pull in — there is no cookie/session scoping here, the key itself is
 * the credential.
 *
 * Every caller MUST do its own authorization check (getCurrentAdmin() +
 * hasPermission(...)) before using this client. Unlike the normal
 * request-scoped client (lib/supabase/server.ts), RLS provides no safety
 * net here — Postgres policies don't apply to the Auth Admin API at all,
 * and this client bypasses RLS on every table too. Skipping the
 * permission check here is a real authorization hole, not just bad
 * practice.
 *
 * Requires SUPABASE_SERVICE_ROLE_KEY as a server-only env var (never
 * NEXT_PUBLIC_ — that prefix ships to the browser bundle). It is not set
 * by default in this project; see docs/admin-management.md for where to
 * get it and how to add it, in Vercel's project settings and local
 * .env.local, never pasted into chat or committed to the repo.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY isn't configured. Inviting an admin needs the Supabase Auth Admin API, which requires the service-role key as a server-side environment variable — add it in Vercel (Project Settings → Environment Variables) and your local .env.local, then redeploy. See docs/admin-management.md."
    );
  }

  return createSupabaseClient<Database>(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

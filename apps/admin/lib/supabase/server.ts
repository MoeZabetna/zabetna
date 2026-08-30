import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@zabetna/shared-types";

// Server Component / Server Action / Route Handler client. Reads/writes the
// session via Next's cookie store so every query runs AS the logged-in
// admin — RLS (has_permission / etc. from supabase/migrations/0001_init.sql)
// is what actually enforces access, not this file.
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch {
            // Called from a Server Component that can't set cookies — safe to
            // ignore. proxy.ts (formerly middleware.ts) is intentionally a
            // no-op (see its own comment) and does NOT refresh the session; the browser client
            // (lib/supabase/client.ts) is what keeps the session cookie fresh.
          }
        },
      },
    }
  );
}

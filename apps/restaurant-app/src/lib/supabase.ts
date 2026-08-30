import { createZabetnaClient } from "@zabetna/api-client";

// Mirrors apps/user-app/src/lib/supabase.ts exactly — same factory, same
// env-var convention, same fail-fast on misconfiguration.
const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  throw new Error(
    "Missing EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY — check apps/restaurant-app/.env"
  );
}

export const supabase = createZabetnaClient(url, anonKey);

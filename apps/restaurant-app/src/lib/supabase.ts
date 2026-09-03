import AsyncStorage from "@react-native-async-storage/async-storage";
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

// AsyncStorage is required, not optional: React Native has no `localStorage`,
// so without it supabase-js keeps the session in memory only and staff are
// signed out every time the app restarts — on a till device that is reopened
// all day, that would mean re-entering credentials constantly.
// `detectSessionInUrl: false` because there is no URL bar to read a
// magic-link fragment out of.
export const supabase = createZabetnaClient(url, anonKey, {
  storage: AsyncStorage,
  detectSessionInUrl: false,
});

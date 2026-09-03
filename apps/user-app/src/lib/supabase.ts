import AsyncStorage from "@react-native-async-storage/async-storage";
import { createZabetnaClient } from "@zabetna/api-client";

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  throw new Error(
    "Missing EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY — check apps/user-app/.env"
  );
}

// AsyncStorage is required, not optional: React Native has no `localStorage`,
// so without it supabase-js keeps the session in memory only and the user is
// signed out every time the app restarts. `detectSessionInUrl: false` for the
// same class of reason — there is no URL bar to read a magic-link fragment
// out of, and leaving it on makes supabase-js reach for `window`.
export const supabase = createZabetnaClient(url, anonKey, {
  storage: AsyncStorage,
  detectSessionInUrl: false,
});

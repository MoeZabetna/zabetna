import { Platform } from "react-native";
import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * User-facing notifications.
 *
 * Two layers, deliberately separate:
 *
 *  1. **The inbox** (`public.notifications`) is the source of truth. Rows
 *     are written by database triggers in the same transaction as the event
 *     that caused them (`0022_user_notifications.sql`), so a user always
 *     finds out a payout was sent — at the latest, next time they open the
 *     app.
 *  2. **Push** is best-effort delivery on top. It can fail for reasons
 *     entirely outside this app (permission denied, token expired, device
 *     offline, no EAS project configured yet) and none of those may cost
 *     the user the message. Nothing here treats a failed push as an error
 *     worth showing.
 */

export type AppNotification = {
  id: string;
  kind: "reward_confirmed" | "reward_rejected" | "points_earned";
  title: string;
  body: string;
  readAt: string | null;
  createdAt: string;
};

type NotificationRow = {
  id: string;
  kind: AppNotification["kind"];
  title: string;
  body: string;
  read_at: string | null;
  created_at: string;
};

export async function fetchNotifications(
  client: SupabaseClient,
  limit = 50
): Promise<AppNotification[]> {
  const { data, error } = await client
    .from("notifications")
    .select("id, kind, title, body, read_at, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);

  return ((data ?? []) as NotificationRow[]).map((row) => ({
    id: row.id,
    kind: row.kind,
    title: row.title,
    body: row.body,
    readAt: row.read_at,
    createdAt: row.created_at,
  }));
}

export async function markNotificationsRead(client: SupabaseClient, ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  await client.from("notifications").update({ read_at: new Date().toISOString() }).in("id", ids);
}

export type PushRegistration =
  | { status: "registered"; token: string }
  | { status: "skipped"; reason: string };

/**
 * Registers this device for push and stores the token against the signed-in
 * user.
 *
 * Returns a `skipped` reason rather than throwing, for every case that is
 * normal rather than broken: simulators have no push hardware, users may
 * decline the permission prompt, and `getExpoPushTokenAsync` needs an EAS
 * project id that only exists after `eas init` has been run for this app.
 * None of those should surface to the user as a failure.
 */
export async function registerForPush(client: SupabaseClient): Promise<PushRegistration> {
  if (!Device.isDevice) {
    return { status: "skipped", reason: "Push notifications need a physical device — simulators have no token." };
  }

  const existing = await Notifications.getPermissionsAsync();
  let granted = existing.granted;
  if (!granted && existing.canAskAgain) {
    const asked = await Notifications.requestPermissionsAsync();
    granted = asked.granted;
  }
  if (!granted) {
    return { status: "skipped", reason: "Notification permission not granted." };
  }

  // `easConfig.projectId` is populated once `eas init` has linked this app
  // to an EAS project. Until then Expo cannot mint a push token, and that's
  // a setup step, not a bug — see docs.
  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId ?? undefined;
  if (!projectId) {
    return {
      status: "skipped",
      reason: "No EAS project id — run `eas init` in apps/user-app to enable push tokens.",
    };
  }

  let token: string;
  try {
    const result = await Notifications.getExpoPushTokenAsync({ projectId });
    token = result.data;
  } catch (err) {
    return { status: "skipped", reason: err instanceof Error ? err.message : "Could not get a push token." };
  }

  const { data: sessionData } = await client.auth.getSession();
  const userId = sessionData.session?.user.id;
  if (!userId) return { status: "skipped", reason: "Not signed in." };

  // Upsert on `token`: the same device signing in as a different account
  // must move to that account rather than keep notifying the previous one.
  const { error } = await client
    .from("push_tokens")
    .upsert(
      { user_id: userId, token, platform: Platform.OS === "ios" ? "ios" : "android" },
      { onConflict: "token" }
    );
  if (error) return { status: "skipped", reason: error.message };

  return { status: "registered", token };
}

/** Removes this device's token so a signed-out phone stops receiving pushes. */
export async function unregisterPush(client: SupabaseClient): Promise<void> {
  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId ?? undefined;
  if (!Device.isDevice || !projectId) return;
  try {
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    await client.from("push_tokens").delete().eq("token", token);
  } catch {
    // Nothing to clean up if a token can't even be minted.
  }
}

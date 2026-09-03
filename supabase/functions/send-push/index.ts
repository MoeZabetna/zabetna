// supabase/functions/send-push
//
// Delivers the push half of a notification. The *record* of every
// notification is already committed to `public.notifications` by a database
// trigger (supabase/migrations/0022_user_notifications.sql) in the same
// transaction as the event that caused it, so this function is pure
// delivery: if it never runs, users still see their notifications in the
// app. That is the whole reason it's shaped as a sweep over unpushed rows
// rather than a fire-and-forget call inside the trigger — a push that fails
// can simply be retried on the next sweep, and one that never succeeds
// costs nobody the message.
//
// Invocation: intended to be called with the **service role key** in the
// Authorization header, either from a Supabase Database Webhook on
// `notifications` INSERT or from a scheduled job. `verify_jwt` stays on, so
// an anonymous caller cannot trigger a send.
//
// Expo's push API needs no credentials for tokens minted by the same Expo
// project, which is why there is no secret to configure here.

import { createClient } from "jsr:@supabase/supabase-js@2";

const EXPO_PUSH_ENDPOINT = "https://exp.host/--/api/v2/push/send";

// Expo rejects batches larger than 100 messages.
const BATCH_SIZE = 100;

// Rows older than this are not worth pushing — the user has almost
// certainly seen them in the app by now, and a day-late "your payout was
// sent" buzz is worse than none.
const MAX_AGE_HOURS = 24;

type NotificationRow = {
  id: string;
  user_id: string;
  title: string;
  body: string;
  data: Record<string, unknown>;
};

type TokenRow = { user_id: string; token: string };

Deno.serve(async (req) => {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "Missing Authorization header" }, 401);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const since = new Date(Date.now() - MAX_AGE_HOURS * 60 * 60 * 1000).toISOString();

  const { data: pending, error: pendingError } = await supabase
    .from("notifications")
    .select("id, user_id, title, body, data")
    .is("pushed_at", null)
    .gte("created_at", since)
    .order("created_at", { ascending: true })
    .limit(500);

  if (pendingError) return json({ error: pendingError.message }, 500);
  if (!pending || pending.length === 0) return json({ sent: 0, skipped: 0, note: "nothing pending" });

  const rows = pending as NotificationRow[];
  const userIds = [...new Set(rows.map((r) => r.user_id))];

  const { data: tokenRows, error: tokenError } = await supabase
    .from("push_tokens")
    .select("user_id, token")
    .in("user_id", userIds);

  if (tokenError) return json({ error: tokenError.message }, 500);

  const tokensByUser = new Map<string, string[]>();
  for (const row of (tokenRows ?? []) as TokenRow[]) {
    const list = tokensByUser.get(row.user_id) ?? [];
    list.push(row.token);
    tokensByUser.set(row.user_id, list);
  }

  const messages: { to: string; title: string; body: string; data: Record<string, unknown> }[] = [];
  // A notification for a user with no registered device is marked pushed
  // anyway. Leaving it unpushed would make it a permanent retry candidate
  // on every future sweep, and there is nothing to deliver it to — the row
  // is still in their in-app inbox, which is the guarantee that matters.
  const deliverable: string[] = [];
  const undeliverable: string[] = [];

  for (const row of rows) {
    const tokens = tokensByUser.get(row.user_id) ?? [];
    if (tokens.length === 0) {
      undeliverable.push(row.id);
      continue;
    }
    deliverable.push(row.id);
    for (const to of tokens) {
      messages.push({ to, title: row.title, body: row.body, data: { ...row.data, notificationId: row.id } });
    }
  }

  let accepted = 0;
  const errors: string[] = [];

  for (let i = 0; i < messages.length; i += BATCH_SIZE) {
    const batch = messages.slice(i, i + BATCH_SIZE);
    try {
      const response = await fetch(EXPO_PUSH_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(batch),
      });
      const payload = await response.json();
      if (!response.ok) {
        errors.push(`Expo returned ${response.status}`);
        continue;
      }
      // Expo answers per-message. A DeviceNotRegistered ticket means the
      // app was uninstalled or the token rotated — drop that token so the
      // next sweep doesn't keep paying for it.
      const tickets: { status: string; details?: { error?: string } }[] = payload.data ?? [];
      for (let t = 0; t < tickets.length; t++) {
        const ticket = tickets[t];
        if (ticket.status === "ok") {
          accepted++;
        } else if (ticket.details?.error === "DeviceNotRegistered") {
          const deadToken = batch[t]?.to;
          if (deadToken) await supabase.from("push_tokens").delete().eq("token", deadToken);
        }
      }
    } catch (err) {
      errors.push(err instanceof Error ? err.message : String(err));
    }
  }

  const toMark = [...deliverable, ...undeliverable];
  if (toMark.length > 0) {
    await supabase
      .from("notifications")
      .update({ pushed_at: new Date().toISOString() })
      .in("id", toMark);
  }

  return json({
    notifications: rows.length,
    pushMessages: messages.length,
    accepted,
    withoutDevice: undeliverable.length,
    errors,
  });
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

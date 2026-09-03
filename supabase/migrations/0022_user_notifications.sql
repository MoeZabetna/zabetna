-- 0022_user_notifications.sql
--
-- Closes gap 2 in docs/rewards-program.md: "No user-facing notification
-- when a request is confirmed." Mo's original requirement was explicitly
-- "users get a notification that points redeem", and until now a user had
-- no way to learn their payout had been sent except by noticing the Wish
-- Money transfer arrive.
--
-- Design decision: the *record* of a notification lives in the database and
-- is written by a trigger inside the same transaction as the status change
-- that caused it. Push delivery is a separate, best-effort layer on top
-- (supabase/functions/send-push). That ordering matters — a push can fail
-- for a dozen reasons outside our control (token expired, device offline,
-- notifications disabled, APNs outage), and none of those should mean the
-- user never finds out. Because the row is committed with the status
-- change, the worst case degrades to "they see it next time they open the
-- app" rather than "they never see it".

-- ─────────────────────────────────────────────────────────────────────────
-- Notification inbox
-- ─────────────────────────────────────────────────────────────────────────

create type notification_kind as enum (
  'reward_confirmed',   -- payout sent, money is on its way
  'reward_rejected',    -- payout declined, points returned to balance
  'points_earned'       -- a redemption was verified at a shop
);

create table notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references profiles (id) on delete cascade,
  kind       notification_kind not null,
  title      text not null,
  body       text not null,
  -- Free-form payload for deep-linking (e.g. which request, how much).
  data       jsonb not null default '{}'::jsonb,
  read_at    timestamptz,
  -- Set by send-push once Expo has accepted the message. Null means either
  -- "not attempted yet" or "attempted and failed" — deliberately not a
  -- boolean, so a retry sweep can find rows to re-attempt by age.
  pushed_at  timestamptz,
  created_at timestamptz not null default now()
);

create index notifications_user_recent_idx
  on notifications (user_id, created_at desc);
-- Partial index: the badge count query only ever asks for unread rows, and
-- unread is the small minority once the app has been used for a while.
create index notifications_unread_idx
  on notifications (user_id) where read_at is null;
create index notifications_unpushed_idx
  on notifications (created_at) where pushed_at is null;

alter table notifications enable row level security;

-- Users read their own notifications and may mark them read. They cannot
-- insert: every row is written by a SECURITY DEFINER trigger below, so a
-- client can never fabricate a "your payout was sent" message.
create policy notifications_own_read on notifications
  for select using (user_id = (select auth.uid()));
create policy notifications_own_update on notifications
  for update using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- ─────────────────────────────────────────────────────────────────────────
-- Expo push tokens
-- ─────────────────────────────────────────────────────────────────────────

create table push_tokens (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references profiles (id) on delete cascade,
  -- Expo push token, e.g. ExponentPushToken[xxxxxxxx]. Unique because the
  -- same physical device handed to a second account must move with it
  -- rather than notifying the previous owner.
  token      text not null unique,
  platform   text not null check (platform in ('ios', 'android')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index push_tokens_user_idx on push_tokens (user_id);

create trigger trg_push_tokens_updated_at before update on push_tokens
  for each row execute function set_updated_at();

alter table push_tokens enable row level security;

create policy push_tokens_own on push_tokens
  for all using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- ─────────────────────────────────────────────────────────────────────────
-- Triggers that actually write the notifications
-- ─────────────────────────────────────────────────────────────────────────

create or replace function public.notify_reward_request_processed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Only the one real transition matters: pending -> confirmed/rejected.
  -- guard_reward_request_transition() already refuses anything else, so
  -- this is belt-and-braces rather than the only line of defence.
  if old.status = new.status or old.status <> 'pending' then
    return new;
  end if;

  if new.status = 'confirmed' then
    insert into notifications (user_id, kind, title, body, data)
    values (
      new.user_id,
      'reward_confirmed',
      'Your payout was sent',
      format(
        'We sent $%s to %s via Wish Money. It can take up to 24 hours to appear.',
        to_char(new.usd_amount, 'FM999999990.00'),
        new.phone_number
      ),
      jsonb_build_object(
        'request_id', new.id,
        'usd_amount', new.usd_amount,
        'points', new.points_requested
      )
    );
  elsif new.status = 'rejected' then
    insert into notifications (user_id, kind, title, body, data)
    values (
      new.user_id,
      'reward_rejected',
      'Your payout request was declined',
      coalesce(
        nullif(trim(new.admin_note), ''),
        'Your points have been returned to your balance and can be redeemed again.'
      ),
      jsonb_build_object('request_id', new.id, 'points', new.points_requested)
    );
  end if;

  return new;
end;
$$;

comment on function public.notify_reward_request_processed is
  'Writes the user-facing notification for a payout being confirmed or rejected, in the same transaction as the status change so it can never be lost.';

create trigger trg_notify_reward_request_processed
  after update on reward_redemption_requests
  for each row execute function public.notify_reward_request_processed();

create or replace function public.notify_points_earned()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  shop_name text;
begin
  if old.status = new.status or new.status <> 'verified' then
    return new;
  end if;

  select s.name into shop_name from shops s where s.id = new.shop_id;

  insert into notifications (user_id, kind, title, body, data)
  values (
    new.user_id,
    'points_earned',
    'You earned a point',
    format(
      'Your redemption at %s was confirmed. That''s 1 point ($0.25) added to your balance.',
      coalesce(shop_name, 'the shop')
    ),
    jsonb_build_object('redemption_id', new.id, 'shop_id', new.shop_id)
  );

  return new;
end;
$$;

comment on function public.notify_points_earned is
  'Writes the "you earned a point" notification when a redemption is verified at a shop — the same event that the fee trigger and the points view key off.';

create trigger trg_notify_points_earned
  after update on redemptions
  for each row execute function public.notify_points_earned();

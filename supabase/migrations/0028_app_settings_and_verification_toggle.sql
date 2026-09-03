-- 0028_app_settings_and_verification_toggle.sql
--
-- Payout-time phone verification (0025-0027) is built and tested, but it
-- cannot complete until an SMS provider is configured in Supabase, and Mo
-- wants to first verify end-to-end that the User App, Restaurant App and
-- Admin Panel are in sync. A hard requirement would block exactly that
-- testing.
--
-- So the requirement becomes a **flag, defaulting off**, rather than being
-- deleted and re-added later. The screen, the RPC, the reset-on-change
-- trigger and the column privileges all stay exactly as they are; only the
-- gate in `set_reward_request_amounts()` consults this setting. Turning
-- verification on after Twilio is wired up is then a one-row UPDATE, with
-- no code change and nothing to re-review.
--
-- The $1.00 service fee is NOT behind this flag. It is a pricing rule, not
-- a technical dependency, and applies from now on regardless.

create table app_settings (
  key         text primary key,
  value       jsonb not null,
  description text,
  updated_at  timestamptz not null default now()
);

create trigger trg_app_settings_updated_at before update on app_settings
  for each row execute function set_updated_at();

alter table app_settings enable row level security;

-- Readable by everyone: these are client-behaviour switches, not secrets,
-- and the User App has to know whether to show the verification step.
-- Writable only by an admin who can already authorise real payouts —
-- `rewards.manage` is the narrowest existing permission that fits, and it
-- is seeded to Super Admin only.
create policy app_settings_public_read on app_settings
  for select using (true);
create policy app_settings_admin_write on app_settings
  for all using (has_permission('rewards.manage'))
  with check (has_permission('rewards.manage'));

insert into app_settings (key, value, description) values (
  'reward_phone_verification_required',
  'false'::jsonb,
  'When true, a payout request requires profiles.phone_verified_at to be set (OTP-verified number). Set to false on 2026-09-03 so the end-to-end flow could be tested before an SMS provider exists. Flip to true once Supabase Auth has a phone provider configured — no code change needed.'
);

create or replace function public.reward_phone_verification_required()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  -- Defaults to TRUE when the row is missing: if this setting is ever
  -- deleted, the safe failure is to demand verification, not to skip it.
  select coalesce(
    (select (value #>> '{}')::boolean from app_settings
      where key = 'reward_phone_verification_required'),
    true
  );
$$;

comment on function public.reward_phone_verification_required is
  'Whether payouts currently require an OTP-verified phone number. Read by set_reward_request_amounts() and by the User App to decide whether to show the Verify screen. Fails safe (true) if the setting row is missing.';

grant execute on function public.reward_phone_verification_required() to anon, authenticated;

-- Same function as 0025, with the verification check made conditional.
create or replace function public.set_reward_request_amounts()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  earned int;
  already_claimed int;
  available int;
  user_phone text;
  verified_at timestamptz;
  fee numeric(10,2) := 1.00;
  gross numeric(10,2);
begin
  select phone, phone_verified_at into user_phone, verified_at
    from public.profiles where id = new.user_id;

  if user_phone is null or user_phone = '' then
    raise exception 'Add a phone number to your profile before requesting a payout — the transfer is sent to your registered number.';
  end if;

  -- Conditional since 0028. The check itself is unchanged; only whether it
  -- applies is now configurable.
  if public.reward_phone_verification_required() and verified_at is null then
    raise exception 'Verify your phone number before requesting a payout — we send a code by SMS to confirm the transfer reaches you.';
  end if;

  select count(*) into earned
  from public.redemptions
  where user_id = new.user_id and status = 'verified';

  select coalesce(sum(points_requested), 0) into already_claimed
  from public.reward_redemption_requests
  where user_id = new.user_id and status <> 'rejected';

  available := earned - already_claimed;

  if available < 40 then
    raise exception 'Insufficient point balance: % available, 40 points ($10.00) minimum to request a payout.', available;
  end if;

  gross := available * 0.25;

  if gross <= fee then
    raise exception 'Payout of $% would be entirely consumed by the $% service fee.', gross, fee;
  end if;

  new.points_requested := available;
  new.usd_amount      := gross;
  new.service_fee_usd := fee;
  new.net_usd_amount  := gross - fee;
  new.phone_number    := user_phone;
  new.status          := 'pending';
  new.processed_at    := null;
  new.processed_by    := null;
  return new;
end;
$$;

-- ── Turning it back on, once Twilio/MessageBird is configured ────────────
--
--   update public.app_settings
--      set value = 'true'::jsonb
--    where key = 'reward_phone_verification_required';
--
-- Nothing else needs to change: the User App reads the same flag and starts
-- routing Redeem through the Verify screen again on its next load.

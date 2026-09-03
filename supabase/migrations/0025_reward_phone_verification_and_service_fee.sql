-- 0025_reward_phone_verification_and_service_fee.sql
--
-- Two rules from Mo, 2026-09-03:
--
--   1. A user verifies their phone number by OTP **at payout time** — when
--      they have enough points and press Redeem — not at signup. Signup
--      still collects the number; it just isn't trusted until this step.
--   2. Every payout submission carries a **$1.00 service fee**, deducted
--      from the cash. The first submission's fee also covers the cost of
--      the OTP verification; it is not charged twice. Confirmed explicitly:
--      40 points = $10.00 gross, less $1.00 = **$9.00 received**, on the
--      first payout and every one after it.
--
-- The fee is stored per-request rather than read from a constant at display
-- time, for the same reason `redemptions.fee_amount_usd` is: a request must
-- always be able to say what *it* charged, even after the rate changes.
-- Recomputing historical payouts from today's fee would silently rewrite
-- what a user was told they'd receive.

-- ─────────────────────────────────────────────────────────────────────────
-- Phone verification state
-- ─────────────────────────────────────────────────────────────────────────

alter table public.profiles
  add column phone_verified_at timestamptz;

comment on column public.profiles.phone_verified_at is
  'When the CURRENT value of `phone` was verified by OTP. Null means unverified. Reset to null automatically whenever `phone` changes — see trg_profiles_phone_change_resets_verification.';

-- Verification belongs to a *number*, not to an account. If the user edits
-- their phone, the old verification says nothing about the new number, and
-- letting it carry over would mean a payout could be sent to a number
-- nobody ever proved they control — which is the entire risk this feature
-- exists to close.
create or replace function public.reset_phone_verification_on_change()
returns trigger
language plpgsql
as $$
begin
  if new.phone is distinct from old.phone then
    new.phone_verified_at := null;
  end if;
  return new;
end;
$$;

comment on function public.reset_phone_verification_on_change is
  'Clears phone_verified_at whenever profiles.phone changes, so a verification can never outlive the number it was for.';

create trigger trg_profiles_phone_change_resets_verification
  before update on public.profiles
  for each row execute function public.reset_phone_verification_on_change();

-- ─────────────────────────────────────────────────────────────────────────
-- Service fee on payout requests
-- ─────────────────────────────────────────────────────────────────────────

alter table public.reward_redemption_requests
  add column service_fee_usd numeric(10, 2) not null default 1.00,
  add column net_usd_amount  numeric(10, 2);

-- Existing rows: there are none in production (verified before this
-- migration), but a rebuilt-from-scratch database running the seed
-- migrations must not end up with nulls in a money column.
update public.reward_redemption_requests
   set net_usd_amount = usd_amount - service_fee_usd
 where net_usd_amount is null;

alter table public.reward_redemption_requests
  alter column net_usd_amount set not null,
  add constraint reward_requests_net_positive check (net_usd_amount > 0),
  add constraint reward_requests_fee_non_negative check (service_fee_usd >= 0),
  add constraint reward_requests_net_matches_gross
    check (net_usd_amount = usd_amount - service_fee_usd);

comment on column public.reward_redemption_requests.service_fee_usd is
  'Service fee withheld from this payout, locked at request time. $1.00 as of 2026-09-03. The first payout''s fee also covers OTP verification — users are never charged twice.';
comment on column public.reward_redemption_requests.net_usd_amount is
  'What the user actually receives: usd_amount - service_fee_usd. THIS is the figure to transfer via Wish Money, not usd_amount.';

-- ─────────────────────────────────────────────────────────────────────────
-- The insert trigger now also demands a verified number, and computes net
-- ─────────────────────────────────────────────────────────────────────────

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

  -- New in 0025. Checked here, in the same trigger that locks the amounts,
  -- so an unverified number cannot be paid out no matter which client
  -- inserts the row.
  if verified_at is null then
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

  -- Belt and braces against a future fee rise outrunning the minimum: at 40
  -- points the gross is $10.00 and the fee $1.00, so this cannot fire
  -- today, but a fee change without a matching minimum change would
  -- otherwise create a zero or negative payout.
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

-- The immutability guard must lock the two new money columns too, or the
-- one thing it exists to prevent — a processed request's figures changing
-- after the fact — would have a hole in it exactly where the fee lives.
create or replace function public.guard_reward_request_transition()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if old.status <> 'pending' then
    raise exception 'This request was already % — processed requests cannot be changed.', old.status;
  end if;
  if new.status not in ('confirmed', 'rejected') then
    raise exception 'A pending request can only move to confirmed or rejected.';
  end if;
  new.processed_at    := now();
  new.points_requested := old.points_requested;
  new.usd_amount      := old.usd_amount;
  new.service_fee_usd := old.service_fee_usd;
  new.net_usd_amount  := old.net_usd_amount;
  new.phone_number    := old.phone_number;
  new.user_id         := old.user_id;
  new.requested_at    := old.requested_at;
  return new;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────
-- Downstream: say the NET figure, everywhere it matters
-- ─────────────────────────────────────────────────────────────────────────

-- The notification is what the user reads to check the transfer arrived, so
-- it must quote what actually lands in their Wish Money, and be explicit
-- about the fee rather than leaving them to work out a $1 discrepancy.
create or replace function public.notify_reward_request_processed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
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
        'We sent $%s to %s via Wish Money ($%s less the $%s service fee). It can take up to 24 hours to appear.',
        to_char(new.net_usd_amount, 'FM999999990.00'),
        new.phone_number,
        to_char(new.usd_amount, 'FM999999990.00'),
        to_char(new.service_fee_usd, 'FM999999990.00')
      ),
      jsonb_build_object(
        'request_id', new.id,
        'usd_amount', new.usd_amount,
        'service_fee_usd', new.service_fee_usd,
        'net_usd_amount', new.net_usd_amount,
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
        'Your points have been returned to your balance and can be redeemed again. You were not charged the service fee.'
      ),
      jsonb_build_object('request_id', new.id, 'points', new.points_requested)
    );
  end if;

  return new;
end;
$$;

-- `lifetime_paid_usd` should be what the user actually received, not the
-- pre-fee figure — it is displayed to admins as "paid", and paying $9.00
-- while reporting $10.00 would misstate real money. Gross stays available
-- per-request for reconciliation.
create or replace view public.user_points_summary
with (security_invoker = true) as
  select p.id as user_id,
         p.full_name,
         p.phone,
         p.gender,
         p.date_of_birth,
         p.created_at as registered_at,
         coalesce(vr.redemption_count, 0::bigint) as redemption_count,
         coalesce(vr.redemption_count, 0::bigint) as points_earned,
         coalesce(req.reserved_or_paid, 0::bigint) as points_claimed,
         coalesce(vr.redemption_count, 0::bigint) - coalesce(req.reserved_or_paid, 0::bigint) as points_available,
         (coalesce(vr.redemption_count, 0::bigint) - coalesce(req.reserved_or_paid, 0::bigint))::numeric * 0.25 as available_usd,
         coalesce(req.paid_usd, 0::numeric) as lifetime_paid_usd,
         -- Appended at the END deliberately: `create or replace view` can
         -- only add columns after the existing ones, never reorder them.
         -- Slotting this next to `phone` where it reads better would make
         -- the replace fail.
         p.phone_verified_at
    from profiles p
    left join (
      select redemptions.user_id, count(*) as redemption_count
        from redemptions
       where redemptions.status = 'verified'::redemption_status
       group by redemptions.user_id
    ) vr on vr.user_id = p.id
    left join (
      select reward_redemption_requests.user_id,
             sum(reward_redemption_requests.points_requested)
               filter (where reward_redemption_requests.status <> 'rejected'::reward_request_status) as reserved_or_paid,
             sum(reward_redemption_requests.net_usd_amount)
               filter (where reward_redemption_requests.status = 'confirmed'::reward_request_status) as paid_usd
        from reward_redemption_requests
       group by reward_redemption_requests.user_id
    ) req on req.user_id = p.id;

comment on view public.user_points_summary is
  'Per-user points and payout summary. lifetime_paid_usd is NET of service fees — what the user actually received. phone_verified_at is exposed so the User App can tell whether a payout needs OTP verification first.';

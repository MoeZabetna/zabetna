-- 0016_rewards_program.sql
--
-- Points-based loyalty program: every verified redemption earns a user 1
-- point; 1 point = $0.25 USD; a user can request to cash out once their
-- available balance is >= 40 points ($10.00); an admin manually wires the
-- money via Wish Money outside this app, then confirms the request here.
--
-- Confirmed with Mo (2026-08-30): 1 point per verified redemption, rate
-- $0.25/point, minimum payout 40 points ($10.00).

-- 1. profiles.gender / profiles.date_of_birth — needed for the new Users
--    admin tab. Both nullable: existing/demo profiles predate these
--    fields, and a real user's own app shouldn't force them to answer at
--    signup if the product doesn't require it.
create type public.gender_option as enum ('male', 'female', 'prefer_not_to_say');

alter table public.profiles
  add column gender public.gender_option,
  add column date_of_birth date;

comment on column public.profiles.gender is
  'Self-reported by the user (profiles_self_rw RLS lets a user update their own row). Nullable — not required at signup.';
comment on column public.profiles.date_of_birth is
  'Self-reported. Nullable.';

-- 2. reward_redemption_requests — a user's request to cash out their
--    point balance. Deliberately NOT a free-form "how many points do you
--    want to redeem" amount: pressing "Redeem" sweeps the user's entire
--    available balance into one request, which is what "press redeem"
--    as a single button (no amount picker) in the product description
--    implies, and avoids a whole class of partial-balance bugs.
create type public.reward_request_status as enum ('pending', 'confirmed', 'rejected');

create table public.reward_redemption_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id),
  points_requested integer not null check (points_requested > 0),
  usd_amount numeric(10, 2) not null check (usd_amount >= 0),
  -- Locked from profiles.phone at request time (by the trigger below),
  -- never taken from client input — this is a real bank transfer
  -- destination, so it comes from the verified profile record, not
  -- whatever a request payload happens to say.
  phone_number text not null,
  status public.reward_request_status not null default 'pending',
  requested_at timestamptz not null default now(),
  processed_at timestamptz,
  processed_by uuid references public.admin_users(id),
  admin_note text
);

comment on table public.reward_redemption_requests is
  'A user''s request to cash out their point balance to Wish Money. points_requested/usd_amount/phone_number are computed and locked server-side by set_reward_request_amounts() at INSERT time — never trust client-supplied values for a real money transfer. See docs/rewards-program.md.';

create index reward_redemption_requests_user_id_idx on public.reward_redemption_requests (user_id);

-- 3. BEFORE INSERT: compute the user's real available balance server-side
--    and overwrite whatever the request payload sent — points_requested,
--    usd_amount, and phone_number are never trusted from the client.
--    Available balance = (their verified redemptions, 1 point each)
--    minus (points already reserved by a pending request, or already
--    paid out by a confirmed one — a rejected request releases its
--    points back to the pool). The $0.25 rate and 40-point minimum are
--    the two numbers confirmed with Mo above; if either ever needs to
--    become admin-configurable, promote them out of this function into
--    a settings table — for now this function is the single source of
--    truth for both.
create or replace function public.set_reward_request_amounts()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  earned int;
  already_claimed int;
  available int;
  user_phone text;
begin
  select phone into user_phone from public.profiles where id = new.user_id;
  if user_phone is null or user_phone = '' then
    raise exception 'Add a phone number to your profile before requesting a payout — the transfer is sent to your registered number.';
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

  new.points_requested := available;
  new.usd_amount := available * 0.25;
  new.phone_number := user_phone;
  new.status := 'pending';
  new.processed_at := null;
  new.processed_by := null;
  return new;
end;
$$;

drop trigger if exists set_reward_request_amounts_trigger on public.reward_redemption_requests;
create trigger set_reward_request_amounts_trigger
  before insert on public.reward_redemption_requests
  for each row
  execute function public.set_reward_request_amounts();

-- 4. Once processed, a request is immutable — protects against a second
--    accidental status change being misread as "money sent twice."
create or replace function public.guard_reward_request_transition()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.status <> 'pending' then
    raise exception 'This request was already % — processed requests cannot be changed.', old.status;
  end if;
  if new.status not in ('confirmed', 'rejected') then
    raise exception 'A pending request can only move to confirmed or rejected.';
  end if;
  new.processed_at := now();
  -- points_requested/usd_amount/phone_number/user_id/requested_at are
  -- locked at this point too — only status/processed_by/admin_note may
  -- change on the transition out of 'pending'.
  new.points_requested := old.points_requested;
  new.usd_amount := old.usd_amount;
  new.phone_number := old.phone_number;
  new.user_id := old.user_id;
  new.requested_at := old.requested_at;
  return new;
end;
$$;

drop trigger if exists guard_reward_request_transition_trigger on public.reward_redemption_requests;
create trigger guard_reward_request_transition_trigger
  before update on public.reward_redemption_requests
  for each row
  execute function public.guard_reward_request_transition();

-- 5. RLS: a user can insert/read their own requests; an admin with
--    users.view can read all of them (same permission that already gates
--    reading profiles — see profiles_admin_read); only rewards.manage
--    can confirm/reject (a distinct, narrower permission than merely
--    viewing, since this represents a real money transfer having been
--    made). No delete policy at all — financial records aren't deleted.
alter table public.reward_redemption_requests enable row level security;

create policy reward_requests_user_read on public.reward_redemption_requests
  for select using (user_id = auth.uid());

create policy reward_requests_user_insert on public.reward_redemption_requests
  for insert with check (user_id = auth.uid());

create policy reward_requests_admin_read on public.reward_redemption_requests
  for select using (has_permission('users.view'));

create policy reward_requests_admin_update on public.reward_redemption_requests
  for update using (has_permission('rewards.manage')) with check (has_permission('rewards.manage'));

-- 6. New permission — deliberately separate from users.view (viewing
--    accounts/requests) since this one represents authorizing that money
--    has actually been sent. Granted to Super Admin only for now; grant
--    it to another role via role_permissions once the Admins UI exists
--    (still on the "still to build" list in blueprint.html).
insert into public.admin_permissions (key, label, category) values
  ('rewards.manage', 'Confirm or reject point payout requests', 'rewards');

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.admin_roles r, public.admin_permissions p
where r.name = 'Super Admin' and p.key = 'rewards.manage';

-- 7. Shared read layer for the Users tab (and the future User App's own
--    "my points" screen) — same security_invoker pattern as
--    verified_redemptions (0014_verified_redemptions_view.sql).
create view public.user_points_summary
with (security_invoker = true)
as
select
  p.id as user_id,
  p.full_name,
  p.phone,
  p.gender,
  p.date_of_birth,
  p.created_at as registered_at,
  coalesce(vr.redemption_count, 0) as redemption_count,
  coalesce(vr.redemption_count, 0) as points_earned, -- 1 point per verified redemption
  coalesce(req.reserved_or_paid, 0) as points_claimed,
  coalesce(vr.redemption_count, 0) - coalesce(req.reserved_or_paid, 0) as points_available,
  (coalesce(vr.redemption_count, 0) - coalesce(req.reserved_or_paid, 0)) * 0.25 as available_usd,
  coalesce(req.paid_usd, 0) as lifetime_paid_usd
from public.profiles p
left join (
  select user_id, count(*) as redemption_count
  from public.redemptions where status = 'verified'
  group by user_id
) vr on vr.user_id = p.id
left join (
  select
    user_id,
    sum(points_requested) filter (where status <> 'rejected') as reserved_or_paid,
    sum(usd_amount) filter (where status = 'confirmed') as paid_usd
  from public.reward_redemption_requests
  group by user_id
) req on req.user_id = p.id;

comment on view public.user_points_summary is
  'Per-user points/redemption summary for the admin Users tab (users.view) and the future User App "my points" screen, scoped by security_invoker to whatever RLS the querying user already has on profiles/redemptions/reward_redemption_requests.';

grant select on public.user_points_summary to authenticated;

-- 0026_sync_verified_phone.sql
--
-- `profiles.phone_verified_at` decides whether real money can be sent to a
-- number, so nothing that a client can simply assert may be allowed to set
-- it. `profiles_self_rw` lets a user update their own row — which means
-- without this, an app could `update profiles set phone_verified_at =
-- now()` and skip the OTP entirely.
--
-- This function is the only sanctioned way to set it. It ignores whatever
-- the caller says and copies the answer out of `auth.users`, where GoTrue
-- records `phone` and `phone_confirmed_at` after a genuine
-- `verifyOtp({ type: 'phone_change' })`. The client cannot forge that.
--
-- The two updates are deliberately separate statements. The BEFORE UPDATE
-- trigger from 0025 clears `phone_verified_at` whenever `phone` changes, so
-- setting both in one statement would have the trigger immediately null out
-- the timestamp being set. Phone first, then the verification stamp.

create or replace function public.sync_verified_phone()
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_phone text;
  v_confirmed timestamptz;
begin
  if v_uid is null then
    raise exception 'Not signed in.';
  end if;

  select u.phone, u.phone_confirmed_at
    into v_phone, v_confirmed
    from auth.users u
   where u.id = v_uid;

  if v_confirmed is null or v_phone is null or v_phone = '' then
    raise exception 'This number has not been confirmed yet. Enter the code we sent by SMS.';
  end if;

  -- GoTrue stores E.164 without the leading '+'. Normalise so the profile
  -- keeps the format the rest of the app (and the admin panel's Wish Money
  -- transfer) displays.
  if left(v_phone, 1) <> '+' then
    v_phone := '+' || v_phone;
  end if;

  update public.profiles set phone = v_phone where id = v_uid;
  update public.profiles set phone_verified_at = v_confirmed where id = v_uid;

  return v_confirmed;
end;
$$;

comment on function public.sync_verified_phone is
  'Copies the signed-in user''s OTP-confirmed phone from auth.users onto their profile and stamps phone_verified_at. The only sanctioned way to mark a number verified — the value is read from GoTrue, never accepted from the client.';

revoke all on function public.sync_verified_phone() from public, anon;
grant execute on function public.sync_verified_phone() to authenticated;

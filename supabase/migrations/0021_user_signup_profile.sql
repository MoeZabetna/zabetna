-- 0021_user_signup_profile.sql
--
-- Nothing has ever created a `profiles` row. Every profile in the database
-- so far arrived through a seed script, because the only accounts that
-- existed were seeded demo users and admins. The moment the User App can
-- sign someone up (built 2026-09-02), that stops being true: a real signup
-- would create an `auth.users` row and no profile, and the user would then
-- be unable to redeem points at all, because
-- `set_reward_request_amounts()` reads `profiles.phone` and rejects a
-- request when it's empty.
--
-- A trigger, not a client-side insert: with "Confirm email" enabled there
-- is no session at the moment of signup, so a client insert would fail RLS
-- (`profiles_self_rw` requires `id = auth.uid()`). SECURITY DEFINER on
-- auth.users is the documented Supabase pattern for exactly this.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Only real app users get a profile. Admins and shop staff are also rows
  -- in auth.users, and they are provisioned with their own admin_users /
  -- shop_staff rows by the admin panel — giving them a consumer profile
  -- too would put them in the Users tab and the points program, which they
  -- are not part of. They are created with metadata that has no
  -- `full_name`+`phone` pair, so this check keys off the User App's signup
  -- payload rather than trying to enumerate account types.
  if new.raw_user_meta_data ? 'full_name' and new.raw_user_meta_data ? 'phone' then
    insert into public.profiles (id, full_name, phone)
    values (
      new.id,
      nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
      nullif(trim(new.raw_user_meta_data ->> 'phone'), '')
    )
    on conflict (id) do nothing;
  end if;

  return new;
end;
$$;

comment on function public.handle_new_user is
  'Creates the consumer profile row for a User App signup. Reads full_name/phone out of the signup metadata; skips accounts (admins, shop staff) that do not carry both.';

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── Phone availability check ────────────────────────────────────────────
-- `profiles.phone` is UNIQUE, and deliberately so: it is the destination
-- of a real Wish Money transfer, so two accounts sharing one number would
-- make a payout ambiguous. That means a signup with an already-registered
-- phone number hits a unique violation *inside the trigger*, which surfaces
-- to the client as an opaque "Database error saving new user".
--
-- This function lets the Sign Up screen check first and say something
-- useful. It returns only a boolean — never whose number it is — so it
-- leaks nothing beyond "taken or not", which the signup attempt itself
-- would reveal anyway.
create or replace function public.phone_available(candidate text)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select not exists (
    select 1 from public.profiles
    where phone is not null
      and phone = nullif(trim(candidate), '')
  );
$$;

comment on function public.phone_available is
  'True when no profile already claims this phone number. Used by the User App signup screen to explain a duplicate before attempting it. Returns a boolean only — never identifies the holder.';

revoke all on function public.phone_available(text) from public;
grant execute on function public.phone_available(text) to anon, authenticated;

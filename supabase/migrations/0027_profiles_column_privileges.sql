-- 0027_profiles_column_privileges.sql
--
-- `profiles_self_rw` is `for all using (id = auth.uid())`, which grants a
-- user full control of *every column* of their own row. That was harmless
-- while the row held only a name and a phone number. It stopped being
-- harmless in 0025, which added `phone_verified_at`: with table-wide UPDATE,
-- any client could run
--
--     update profiles set phone_verified_at = now() where id = <self>
--
-- and then request a payout to a number nobody ever proved they control —
-- skipping the OTP entirely and defeating the point of the whole feature.
-- RLS does not help here: the row genuinely *is* theirs. The right tool is
-- column-level privilege.
--
-- Note the shape: a table-level UPDATE grant covers every column and makes
-- a column-level REVOKE a no-op, so the table-level grant has to go first
-- and the permitted columns be granted back explicitly.
--
-- This also closes a smaller pre-existing hole in the same breath:
-- `status` is the account_status enum used to suspend an account, and until
-- now a suspended user could have set their own row back to 'active'.

revoke update on public.profiles from authenticated;

grant update (full_name, phone, avatar_url, locale, gender, date_of_birth)
  on public.profiles to authenticated;

-- Deliberately NOT grantable to the user:
--   id                -- identity; the RLS check keys off it
--   status            -- suspension is an admin decision
--   phone_verified_at -- only public.sync_verified_phone() may set this,
--                        and it reads the answer from auth.users
--   created_at / updated_at -- maintained by the database

comment on column public.profiles.phone_verified_at is
  'When the CURRENT value of `phone` was verified by OTP. Null means unverified. Reset to null automatically when `phone` changes (trg_profiles_phone_change_resets_verification), and NOT directly updatable by the `authenticated` role — only public.sync_verified_phone() can set it (0027).';

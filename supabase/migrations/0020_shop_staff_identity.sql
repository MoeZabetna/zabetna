-- 0020_shop_staff_identity.sql
--
-- shop_staff had no full_name/email columns — admin_users has both
-- (denormalized at invite time) precisely so the admin UI can list/manage
-- accounts without a service-role auth.users lookup per row. shop_staff
-- never got the same treatment because nothing invited shop staff yet
-- (table is empty — verified before this migration). Adding it now as
-- part of building the admin-side "invite shop staff" flow, required to
-- give the Restaurant App's staff any real login to use.
--
-- RECOVERED 2026-09-02: this migration was applied to the live database on
-- 2026-08-30 (supabase_migrations version 20260830172737) but the file was
-- never committed, so `pnpm db:reset` would have rebuilt a database missing
-- the two columns the Restaurant App's staff login reads. Restored verbatim
-- from the remote `supabase_migrations.schema_migrations.statements`.

alter table public.shop_staff
  add column full_name text not null,
  add column email text not null;

comment on column public.shop_staff.full_name is
  'Display name captured at invite time, mirrors admin_users.full_name. No self-service edit yet.';
comment on column public.shop_staff.email is
  'Login email captured at invite time, mirrors admin_users.email — lets the admin Shops UI list/manage staff without a service-role auth.users lookup per row.';

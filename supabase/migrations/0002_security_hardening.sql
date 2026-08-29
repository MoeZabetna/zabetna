-- Fixes two real issues the Supabase security advisor caught after 0001:
--
-- 1. role_permissions and admin_permissions were left without RLS enabled —
--    an oversight in 0001, not an intentional "public" table. Both are
--    RBAC configuration, so they're scoped the same as admin_users/audit_log:
--    readable only by an admin who holds 'admins.manage'.
--
-- 2. has_permission() / staff_shop_id() / set_updated_at() had a mutable
--    search_path, which is a known SECURITY DEFINER hijacking vector
--    (someone creates an object earlier in a caller-controlled search_path
--    that shadows one the function relies on). Pinned to public, pg_temp.
--
-- Left deliberately unfixed: the advisor also flags that `anon`/`authenticated`
-- can call has_permission()/staff_shop_id() directly as RPCs. Revoking that
-- EXECUTE grant is not safe here — those same roles need it to evaluate the
-- RLS policies on offers/redemptions that unauthenticated users legitimately
-- browse (offers_staff_scope, redemptions_staff_scope), and each function
-- only ever returns a boolean or a uuid derived from the caller's own
-- auth.uid() — nothing about another user is disclosed. Documented instead
-- of silently dropped.

alter table role_permissions   enable row level security;
alter table admin_permissions  enable row level security;

create policy role_permissions_admin_read on role_permissions
  for select using (has_permission('admins.manage'));
create policy admin_permissions_admin_read on admin_permissions
  for select using (has_permission('admins.manage'));

alter function set_updated_at()          set search_path = public, pg_temp;
alter function has_permission(text)      set search_path = public, pg_temp;
alter function staff_shop_id()           set search_path = public, pg_temp;

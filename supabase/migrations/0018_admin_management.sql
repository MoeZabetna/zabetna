-- 0018_admin_management.sql
--
-- Backing for the Admin Panel's own Admins tab (app/(dashboard)/admins):
-- list admin members, invite new ones, change role/status, and let any
-- signed-in admin change their own password. See docs/admin-management.md
-- for the full design and why account creation needs a service-role key
-- the app doesn't have configured yet.

-- 1. audit_log had a read policy (0001_init.sql) but no insert policy —
--    meaning nothing could ever write to it, despite §05 of blueprint.html
--    promising "every action a role permits is also written to audit_log."
--    Admin-management actions (invite/role-change/status-change) are the
--    first real write path, so this is where that gap finally gets closed.
--    Scoped to self-attribution only (an admin can log an entry for
--    themselves, never impersonate another admin_id) rather than gated to
--    a specific permission — so it's ready for other admin-write features
--    to start logging too, without needing their own policy each time.
create policy audit_log_insert on public.audit_log
  for insert with check (
    admin_id in (select id from public.admin_users where auth_user_id = auth.uid())
  );

-- 2. Self-lockout guard: refuse any update to admin_users that would leave
--    zero *active* admins holding admins.manage — whether by demoting the
--    last holder's role or suspending their account. Without this, a
--    mistake (or a bug in the admin actions below) could permanently lock
--    everyone out of ever managing admins again through the app itself —
--    the only way back would be a direct database fix. This is a database
--    trigger, not just an app-layer check, so it holds even against a
--    direct SQL edit or a future bug that skips the app's own guard.
create or replace function public.guard_last_admin_manage_holder()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  old_had_admins_manage boolean;
  new_has_admins_manage boolean;
  remaining_holders int;
begin
  select exists (
    select 1 from role_permissions rp
    join admin_permissions ap on ap.id = rp.permission_id
    where rp.role_id = old.role_id and ap.key = 'admins.manage'
  ) into old_had_admins_manage;

  -- Only relevant if this row currently both grants admins.manage and is
  -- active — an already-suspended or already-non-managing admin isn't
  -- "the" holder of anything, so changing them is never the risk case.
  if old.status = 'active' and old_had_admins_manage then
    select exists (
      select 1 from role_permissions rp
      join admin_permissions ap on ap.id = rp.permission_id
      where rp.role_id = new.role_id and ap.key = 'admins.manage'
    ) into new_has_admins_manage;

    if new.status <> 'active' or not new_has_admins_manage then
      select count(*) into remaining_holders
      from admin_users au
      join role_permissions rp on rp.role_id = au.role_id
      join admin_permissions ap on ap.id = rp.permission_id
      where ap.key = 'admins.manage' and au.status = 'active' and au.id <> old.id;

      if remaining_holders = 0 then
        raise exception 'Cannot remove admin-management access from % — they are the only active admin who can manage other admins. Grant admins.manage to someone else first.', old.email;
      end if;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists guard_last_admin_manage_holder_trigger on public.admin_users;
create trigger guard_last_admin_manage_holder_trigger
  before update on public.admin_users
  for each row execute function public.guard_last_admin_manage_holder();

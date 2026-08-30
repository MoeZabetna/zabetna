-- 0019_rls_perf_and_indexes.sql
--
-- Housekeeping found by mcp__Supabase__get_advisors while auditing the
-- whole schema after the Admins/Users/Reward Program work — not bugs
-- (nothing here was returning wrong data), but real technical debt worth
-- fixing now rather than letting it compound as shops/redemptions/reward
-- requests grow to real volume:
--
-- 1. auth_rls_initplan (WARN): several RLS policies call `auth.uid()`
--    directly, which Postgres re-evaluates for every row scanned rather
--    than once per statement. Supabase's documented fix is wrapping it
--    as `(select auth.uid())`, which the planner can cache. Two of the
--    nine affected policies are ones this session just added
--    (reward_requests_user_read/insert, audit_log_insert) — worth fixing
--    everywhere at once rather than only the new ones, since it's the
--    same one-line change applied uniformly. Semantics are identical;
--    only the evaluation plan changes.
-- 2. unindexed_foreign_keys (INFO): several foreign key columns have no
--    covering index, which slows joins/deletes against the referenced
--    table as row counts grow. Demo-scale data hides this today.
--
-- Left alone, on purpose: `multiple_permissive_policies` (WARN, ~50
-- entries) — this is the intended shape of e.g. shops_public_read +
-- shops_admin_write both applying to SELECT, so a public user sees live
-- shops and an admin sees everything; collapsing them into one policy
-- would risk an actual access bug for a cosmetic perf note. `unused_index`
-- (INFO) — these indexes exist for query patterns (status filters, shop
-- lookups) that just haven't been exercised by real traffic yet at demo
-- scale; removing them now would be premature.

-- ── auth_rls_initplan fixes ────────────────────────────────────────────
drop policy if exists profiles_self_rw on public.profiles;
create policy profiles_self_rw on public.profiles
  for all using (id = (select auth.uid())) with check (id = (select auth.uid()));

drop policy if exists shop_staff_self_read on public.shop_staff;
create policy shop_staff_self_read on public.shop_staff
  for select using (auth_user_id = (select auth.uid()));

drop policy if exists favorites_owner on public.favorites;
create policy favorites_owner on public.favorites
  for all using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

drop policy if exists redemptions_user_read on public.redemptions;
create policy redemptions_user_read on public.redemptions
  for select using (user_id = (select auth.uid()));

drop policy if exists admin_users_self_read on public.admin_users;
create policy admin_users_self_read on public.admin_users
  for select using (auth_user_id = (select auth.uid()));

drop policy if exists admin_roles_read on public.admin_roles;
create policy admin_roles_read on public.admin_roles
  for select using ((select auth.uid()) is not null);

drop policy if exists reward_requests_user_read on public.reward_redemption_requests;
create policy reward_requests_user_read on public.reward_redemption_requests
  for select using (user_id = (select auth.uid()));

drop policy if exists reward_requests_user_insert on public.reward_redemption_requests;
create policy reward_requests_user_insert on public.reward_redemption_requests
  for insert with check (user_id = (select auth.uid()));

drop policy if exists audit_log_insert on public.audit_log;
create policy audit_log_insert on public.audit_log
  for insert with check (
    admin_id in (select id from public.admin_users where auth_user_id = (select auth.uid()))
  );

-- ── unindexed_foreign_keys fixes ───────────────────────────────────────
create index if not exists idx_admin_users_invited_by on public.admin_users (invited_by);
create index if not exists idx_admin_users_role_id on public.admin_users (role_id);
create index if not exists idx_audit_log_admin_id on public.audit_log (admin_id);
create index if not exists idx_banners_category_id on public.banners (category_id);
create index if not exists idx_categories_parent_id on public.categories (parent_id);
create index if not exists idx_favorites_shop_id on public.favorites (shop_id);
create index if not exists idx_featured_listings_shop_id on public.featured_listings (shop_id);
create index if not exists idx_redemptions_verified_by on public.redemptions (verified_by);
create index if not exists idx_reward_requests_processed_by on public.reward_redemption_requests (processed_by);
create index if not exists idx_role_permissions_permission_id on public.role_permissions (permission_id);

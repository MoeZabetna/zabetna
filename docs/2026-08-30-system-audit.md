# System consistency audit (2026-08-30)

Requested explicitly: after building the Admins tab, verify nothing is
broken in the logic connecting shops, offers, redemptions, users,
reports, and the reward program before treating any of it as a
foundation for the user app / shop QR-verification work. This is the
record of what was actually checked and what was found — not a "looks
fine" assertion.

## What was checked, and the result

| Check | Method | Result |
|---|---|---|
| Foreign-key/orphan integrity across offers→shops, redemptions→offers/shops/users, reward requests→users, admin_users→roles, role_permissions→permissions | Direct SQL, 10 targeted `LEFT JOIN ... WHERE ... IS NULL` counts | All zero. No orphaned rows anywhere in the chain. |
| Every verified redemption has a locked fee; every shop has a rate set; no negative minimum-order values | Same pass | All zero / none found. |
| RLS coverage vs. what each admin page/Sidebar entry expects | Read every `page.tsx` permission gate against `Sidebar.tsx`'s `NAV` array and the actual RLS policy backing each query | Consistent everywhere **after** the one real bug below was fixed. |
| Supabase's own security + performance advisors | `mcp__Supabase__get_advisors` (security, performance) | See "What was found and fixed" below. |
| Edge functions (`create-redemption`, `verify-redemption`) still match the current schema | Read both functions' `.from()`/`.select()`/`.update()` calls against current table shape | No drift — they insert/update exactly the columns that exist, and `verify-redemption` setting `status = 'verified'` is the single event that both the fee trigger and the points view key off. |
| Reports totals still match the known seeded data after all schema/RLS changes | `select count(*), sum(fee_amount_usd) from verified_redemptions` | 166 rows, $620.00 total — matches the original seed exactly. |
| Guard triggers still fire correctly after the RLS rewrite below | Rolled-back transactions attempting the exact violation each trigger exists to stop | Both still correctly block: suspending the last `admins.manage` holder, and (from before this audit) demoting them. |

## What was found and fixed

1. **Real bug, already fixed before this audit pass**: `user_points_summary`'s `redemption_count`/`points_earned`/etc. silently computed as 0 for any admin who had `users.view` but not `reports.view` (e.g. Support Agent), because the underlying `redemptions_admin_read` RLS policy only admitted `reports.view`. Fixed in `0017_redemptions_users_view_access.sql` — full writeup in `docs/rewards-program.md`.
2. **Performance debt, not a correctness bug**: 9 RLS policies called `auth.uid()` unwrapped, which Postgres re-evaluates per row instead of once per statement (Supabase's `auth_rls_initplan` lint). 10 foreign key columns had no covering index (`unindexed_foreign_keys`). Both fixed in `0019_rls_perf_and_indexes.sql` — same semantics, just cheaper to evaluate at real volume. Every rewritten policy was re-tested afterward (own profile, own redemptions, own admin row, reward request insert, audit log insert, all as simulated real sessions) to confirm nothing's access changed, only its cost.
3. **Left alone, deliberately**: `multiple_permissive_policies` (WARN) — shops/offers/banners intentionally stack a public-read policy with an admin-write policy that also permits read; collapsing them would risk an actual access bug to silence a cosmetic lint. `unused_index` (INFO) — expected at demo-data scale; these become used once real report/status-filter query volume exists.

## Net result

Nothing was silently broken by the Users/Rewards/Admins work — the one
real defect (item 1) was already caught and fixed during that work, not
newly discovered here. This pass exists to confirm that fix didn't miss
a sibling case elsewhere, and it didn't. The two migrations this audit
added (0017, already shipped; 0019, shipped alongside this doc) are the
only changes that came out of it.

-- 0024_revoke_trigger_function_execute.sql
--
-- Supabase's security advisor (lints 0028/0029,
-- `anon_security_definer_function_executable`) flags the three trigger
-- functions added in 0021/0022 as callable over the REST API at
-- `/rest/v1/rpc/<name>`. They are `SECURITY DEFINER`, so being reachable by
-- `anon` is worth closing even though the practical exposure is small:
-- Postgres refuses to run a trigger function called directly ("trigger
-- functions can only be called as triggers"), so this is defence in depth
-- rather than a fix for a live hole.
--
-- Revoking EXECUTE is safe for a *trigger* function specifically: the
-- trigger fires in the context of the statement that fired it, not as the
-- calling role, so the trigger keeps working.
--
-- Deliberately NOT touched here:
--
--   * `has_permission(text)` and `staff_shop_id()` — these are called from
--     inside RLS policy expressions, which evaluate as the *calling* role.
--     Revoking EXECUTE from `authenticated` would break every admin policy
--     that gates on a permission. They must stay executable.
--   * `set_redemption_fee()`, `set_reward_request_amounts()`,
--     `guard_reward_request_transition()`,
--     `guard_last_admin_manage_holder()` — the same class of trigger
--     function, and the same revoke would be correct for them, but they
--     predate this change. Tightening them is a separate, deliberate pass
--     against money-affecting code, not a side effect of building the User
--     App. They remain flagged by the advisor until then.

revoke execute on function public.handle_new_user() from anon, authenticated;
revoke execute on function public.notify_points_earned() from anon, authenticated;
revoke execute on function public.notify_reward_request_processed() from anon, authenticated;

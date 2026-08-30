-- 0014_verified_redemptions_view.sql
--
-- Shared read layer for redemption reporting: the admin Reports pages use
-- this view today, and the future vendor/shops app (onboarded shops
-- checking "how much do we owe zabetna") should query the same view
-- scoped to their own shop, rather than re-deriving this logic.
--
-- Deliberately built on top of `redemptions.fee_amount_usd` (the fee
-- locked in at redemption-creation time by set_redemption_fee(), see
-- 0012_redemption_fee_and_city.sql) — never a live join to
-- shops.value_per_redemption — so a shop's current rate never changes
-- what a past redemption is reported as owing.
--
-- Only status = 'verified' rows are included: those are the redemptions
-- that actually happened at the shop (scanned and confirmed by shop
-- staff). 'pending' redemptions never completed, and 'expired'/
-- 'cancelled' explicitly did not happen — none of those are billable or
-- meaningful for performance reporting.
--
-- `security_invoker = true` is load-bearing, not decoration: without it
-- this view would run with the view owner's privileges and silently
-- bypass the `redemptions_admin_read` RLS policy (reports.view
-- permission) on the underlying `redemptions` table. With it, every
-- query against this view is re-checked against the querying user's own
-- RLS — exactly the same gate as querying `redemptions` directly.
create view public.verified_redemptions
with (security_invoker = true)
as
select
  r.id,
  r.shop_id,
  s.name as shop_name,
  s.city,
  s.category_id,
  c.name as category_name,
  r.fee_amount_usd,
  r.verified_at,
  -- Beirut-local breakdown, precomputed once here so every consumer
  -- (admin reports today, the vendor app later) buckets days/hours the
  -- same way instead of each re-implementing timezone math.
  (r.verified_at at time zone 'Asia/Beirut') as verified_at_beirut,
  extract(dow from (r.verified_at at time zone 'Asia/Beirut'))::smallint as dow_beirut,
  extract(hour from (r.verified_at at time zone 'Asia/Beirut'))::smallint as hour_beirut
from public.redemptions r
join public.shops s on s.id = r.shop_id
join public.categories c on c.id = s.category_id
where r.status = 'verified';

comment on view public.verified_redemptions is
  'Reporting/billing read layer: verified redemptions only, with the fee locked at redemption time and Beirut-local day/hour precomputed. security_invoker=true means it inherits the querying user''s RLS on redemptions/shops/categories — it grants no access beyond what the caller already has.';

grant select on public.verified_redemptions to authenticated;

-- 0015_offer_minimum_order.sql
--
-- Minimum order value for an offer, in USD. 0 = no minimum. This is
-- display-only, deliberately not enforced by the app: neither
-- `redemptions` nor either edge function (create-redemption,
-- verify-redemption) captures an actual purchase/order amount anywhere —
-- redemption is "does this offer exist and is it within its limits,"
-- verified visually by shop staff scanning a QR code, not a checkout
-- flow that totals a cart. So this column exists purely so the User App
-- can show "Min. order $20" consistently on the offer, the same way
-- per_user_limit/total_limit are already structured fields rather than
-- sentences buried in `terms` — it does not (and today cannot) block a
-- redemption automatically. If real enforcement is wanted later, it
-- would need an order-amount field captured by shop staff during
-- verification to compare against this.
alter table public.offers
  add column minimum_order_value numeric(10, 2) not null default 0
    constraint offers_minimum_order_value_non_negative check (minimum_order_value >= 0);

comment on column public.offers.minimum_order_value is
  'USD minimum order to redeem this offer. 0 = no minimum. Display-only — not enforced by create-redemption/verify-redemption, since neither captures an actual order amount today.';

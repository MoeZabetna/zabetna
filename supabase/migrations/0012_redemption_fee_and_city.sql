-- 0012_redemption_fee_and_city.sql
--
-- Adds the per-shop redemption fee (what zabetna charges a shop, in USD,
-- for each verified redemption) and a free-text city field to `shops`, and
-- adds `fee_amount_usd` to `redemptions` so each redemption row locks in
-- the fee that applied *at the time it happened*.
--
-- Why lock the fee onto the redemption row instead of computing it live
-- (fee_amount_usd = shops.value_per_redemption * count at report time)?
-- Because a shop's rate can change after a redemption already happened.
-- If Reports and the future vendor/shops-app "amount you owe us" screen
-- both joined live to shops.value_per_redemption, then raising or
-- lowering a shop's rate would silently rewrite the historical amount
-- owed for redemptions that already happened at the old rate. That is
-- not just a reporting inconvenience — it is a billing correctness bug.
-- Locking the fee at insert time keeps every past redemption's value
-- exactly what it was when the shop earned/owed it, the same principle
-- used for locking prices/line items on an invoice.
--
-- See docs/vendor-app-fee-reporting.md for the full design writeup aimed
-- at whoever builds the vendor/shops app.

-- 1. shops.value_per_redemption — the USD fee charged to this shop per
--    verified redemption. Nullable: a shop can be onboarded before its
--    commercial rate is finalized, and NULL is meaningfully different
--    from 0 (0 would mean "free", which we do not want to default to).
alter table public.shops
  add column value_per_redemption numeric(10, 2)
    constraint shops_value_per_redemption_non_negative check (value_per_redemption is null or value_per_redemption >= 0);

comment on column public.shops.value_per_redemption is
  'USD fee zabetna charges this shop per verified redemption. NULL = not yet set. Copied onto redemptions.fee_amount_usd at redemption-creation time — changing this does not retroactively change past redemptions.';

-- 2. shops.city — free text, not an enum. The product has not yet decided
--    single-city vs multi-city/country (see docs/blueprint.html), so this
--    is deliberately not locked to a Lebanon-only or Beirut-only enum.
alter table public.shops
  add column city text not null default 'Beirut';

comment on column public.shops.city is
  'Free text on purpose — product has not decided single-city vs multi-city scope yet. Defaults to Beirut for existing/demo shops.';

-- 3. redemptions.fee_amount_usd — the fee that applied to this specific
--    redemption, captured at creation time. Nullable only because a shop
--    may not have a value_per_redemption set yet when the redemption is
--    created; in that case there is nothing to bill and reports should
--    treat it as "fee unknown", not silently coerce to 0.
alter table public.redemptions
  add column fee_amount_usd numeric(10, 2);

comment on column public.redemptions.fee_amount_usd is
  'USD fee owed to zabetna for this redemption, copied from shops.value_per_redemption by set_redemption_fee() at INSERT time. Locked historically — do not recompute by joining to shops at report time.';

-- 4. Fee-capture trigger. BEFORE INSERT, not something layered only into
--    the create-redemption edge function, so it holds for every insert
--    path (edge function today, admin tooling or a future migration
--    tomorrow) without relying on every caller remembering to set it.
create or replace function public.set_redemption_fee()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.fee_amount_usd is null then
    select value_per_redemption into new.fee_amount_usd
    from public.shops
    where id = new.shop_id;
  end if;
  return new;
end;
$$;

comment on function public.set_redemption_fee() is
  'Locks the shop''s current value_per_redemption onto NEW.fee_amount_usd at redemption creation time, so later rate changes never retroactively alter historical redemption/billing figures.';

drop trigger if exists set_redemption_fee_trigger on public.redemptions;
create trigger set_redemption_fee_trigger
  before insert on public.redemptions
  for each row
  execute function public.set_redemption_fee();

-- 5. Backfill demo per-category fee values for the 19 existing demo
--    shops. These are illustrative placeholder rates for the demo data
--    set, NOT real negotiated commercial terms — flagged explicitly so
--    nobody mistakes them for actual pricing decisions.
update public.shops s
set value_per_redemption = case c.name
  when 'Restaurants' then 3.00
  when 'Club & Pubs' then 5.00
  when 'Fashion' then 4.00
  when 'Activities' then 3.50
  when 'Cars' then 10.00
  when 'Pets' then 2.50
  when 'Gym' then 4.00
  when 'Electronic' then 6.00
  else 3.00
end
from public.categories c
where c.id = s.category_id
  and s.value_per_redemption is null;

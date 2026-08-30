# Redemption fee model & what the vendor/shops app needs (2026-08-30)

**Status:** Schema, trigger, and admin-side reporting are built and live.
The vendor/shops app itself (task list items #7/#8 territory — onboarded
shops checking what they owe) is **not built yet**. This doc is the
handoff for whoever builds it, so the billing logic doesn't get
reinvented or — worse — reinvented *differently* from what the admin
Reports pages already show.

## The business model, in one paragraph

Zabetna charges each shop a flat USD fee per verified redemption —
commission-per-redemption, not a listing fee or subscription (this was
the open "business model" question in blueprint.html §08; it's resolved
now, logged in §07's decision table). Each shop has its own rate
(`shops.value_per_redemption`), set by an admin in Shops → Edit shop.
Different shops can and do have different rates (current demo rates
range $2.50–$10.00 depending on category — see
`supabase/migrations/0012_redemption_fee_and_city.sql`'s backfill).

## The one design decision that matters: fee is locked, not live

`redemptions.fee_amount_usd` is set once, at redemption-creation time, by
a `BEFORE INSERT` trigger (`set_redemption_fee()`,
`supabase/migrations/0012_redemption_fee_and_city.sql`) that copies
whatever `shops.value_per_redemption` is *at that instant*. It is **not**
a live join — nothing anywhere computes "amount owed" as
`shops.value_per_redemption * count(redemptions)`.

Why this matters: shop rates will get renegotiated over time. If "amount
owed" were computed live, raising or lowering a shop's rate today would
silently rewrite what they owed for redemptions from three months ago —
which is not a reporting quirk, it's a billing correctness bug (the
Lebanese/Uber/every-real-invoicing-system equivalent of a merchant
discovering their March invoice changed because their May contract
changed). Locking the fee at redemption time is the same principle as
locking a line-item price on an invoice at the time of sale.

**Whoever builds the vendor app: query `redemptions.fee_amount_usd` (or
the `verified_redemptions` view below), never
`shops.value_per_redemption * count`.** The only case where those two
numbers agree is a shop whose rate has never changed — don't rely on that
holding forever.

## Only `status = 'verified'` redemptions count

A redemption's lifecycle (from reading `create-redemption` and
`verify-redemption` in `supabase/functions/`):

- `pending` — created when a User App user taps "Redeem." Not yet real.
- `verified` — shop staff scanned the QR and confirmed it. **This is the
  only status that represents something that actually happened at the
  shop**, and the only one that should ever be billable or counted in
  performance reporting.
- `expired` / `cancelled` — never happened, never billable.

Both the admin Reports pages and the `verified_redemptions` view below
already enforce this. If you're writing new queries directly against
`redemptions`, don't forget the `status = 'verified'` filter — a raw
count of all rows in `redemptions` overcounts by including abandoned
"pending" attempts.

## The shared read layer: `verified_redemptions`

`supabase/migrations/0014_verified_redemptions_view.sql` defines a view
that does the status filter, the shop/category join, and the Beirut-local
day/hour bucketing once, so it doesn't get re-derived (and potentially
re-derived *wrong*) in three different places:

```sql
select * from verified_redemptions where shop_id = '...';
-- columns: id, shop_id, shop_name, city, category_id, category_name,
--          fee_amount_usd, verified_at, verified_at_beirut,
--          dow_beirut (0=Sunday..6=Saturday), hour_beirut (0-23)
```

It's declared `security_invoker = true`, which means it carries no
special access of its own — querying it is exactly as permissioned as
querying `redemptions` directly. Today that's the `redemptions_admin_read`
RLS policy (`reports.view` permission) for admin users. **The vendor app
will need its own RLS policy** scoping `shop_staff` (or whatever the
vendor app's auth model ends up being) to `shop_id = their own shop only`
— that policy doesn't exist yet and has to be added when the vendor app's
auth model is designed, alongside `shop_staff` actually being populated
(it's currently empty — see below).

## What's still missing before a vendor app can actually work

1. **`shop_staff` has zero rows.** `redemptions.verified_by` references
   `shop_staff.id`, and that table is how a shop's own staff would log
   in to see their own numbers. Nobody has been invited yet — this needs
   an invite/onboarding flow, mirroring how `admin_users` invites work.
2. **RLS for shop-scoped reads doesn't exist yet.** The current
   `redemptions_admin_read` policy is admin-only. A shop owner reading
   their own `verified_redemptions` rows needs a new policy — something
   like `shop_id = staff_shop_id()` (there's already a `staff_shop_id()`
   helper function in the DB, currently unused — see
   `mcp__Supabase__list_tables` output, `Functions.staff_shop_id`) rather
   than reusing `has_permission('reports.view')`, which is an *admin*
   permission and shouldn't be how a shop identifies itself.
3. **No "invoice" or "payout" concept exists.** Right now this is purely
   "sum of `fee_amount_usd` for verified redemptions in a date range." If
   the real product needs invoicing, payment tracking, or marking a
   period as "paid," that's new schema (an `invoices` or `payouts` table)
   layered on top of this — the redemption-level fee data above is
   sufficient as the source of truth to compute from, but nothing here
   tracks whether a shop has actually paid.
4. **CSV export** was scoped in blueprint.html §08 for the admin side too
   and still isn't built (the `reports.export` permission key already
   exists in `admin_permissions`, unused so far).

## Demo data note

As of 2026-08-30, `verified_redemptions` has 166 synthetic rows across 7
of the 19 demo shops (only shops with at least one offer can have
redemptions, since `redemptions.offer_id` is `NOT NULL` — see
`supabase/migrations/0013_seed_demo_redemptions.sql` for the full
rationale and the exact cleanup query). These are clearly fabricated for
demoing the Reports UI, not real activity — delete them before connecting
a real vendor app to real shop owners, using the cleanup SQL in that
migration's header comment.

# Points / rewards program design (2026-08-30)

**Status:** Schema, triggers, and the admin-side Users + Reward Program tabs
are built and live. The User App side (a "Redeem" button, balance display,
and the "24–72 hours, weekdays only" processing message) **does not exist
yet** — the User App hasn't been built. This doc is the handoff for
whoever builds it, and the record of the money-affecting decisions made
so a later change doesn't accidentally reintroduce a correctness bug that
was deliberately designed around.

## The business rule, in one paragraph

Every **verified** redemption earns the user 1 point. 1 point = $0.25 USD.
A user can request a payout once their available balance is at least 40
points ($10.00) — below that, a request is rejected server-side before it
is ever created. Confirmed with Mo, 2026-08-30. There is no partial
cash-out: pressing "Redeem" always requests the user's *entire* available
balance in one request, not a chosen amount — matching a single button
with no amount picker.

## Payouts are locked and computed server-side, never trusted from the client

`reward_redemption_requests.points_requested` / `usd_amount` /
`phone_number` are entirely overwritten by a `BEFORE INSERT` trigger
(`set_reward_request_amounts()`, `supabase/migrations/0016_rewards_program.sql`)
regardless of what a client sends in the insert payload. The trigger:

1. Reads the user's own `profiles.phone` — **not** anything the request
   payload says — and rejects the request if it's empty (a phone number is
   required before a payout can be requested, since that's the Wish Money
   transfer destination).
2. Computes `available = (verified redemptions) - (points already
   reserved by a pending request, or already paid by a confirmed one)`. A
   *rejected* request releases its points back to the pool — this is why
   `reserved_or_paid` filters `status <> 'rejected'` rather than summing
   everything.
3. Rejects the insert outright if `available < 40`.
4. Sets `points_requested = available`, `usd_amount = available * 0.25`,
   `phone_number` = the profile's real phone, and forces `status =
   'pending'`.

This is the same "lock the value at the transactional moment, never
recompute live" principle used for `redemptions.fee_amount_usd` (see
`docs/vendor-app-fee-reporting.md`) — except here it protects an actual
outbound bank transfer, not just a report total, so the stakes are higher
and the trigger is stricter about it.

## Once processed, a request is immutable

`guard_reward_request_transition()` (`BEFORE UPDATE`) refuses any change
to a request once `status` has left `'pending'` — a second accidental
status flip can never be misread as "money sent twice." Even on the one
allowed transition (`pending` → `confirmed`/`rejected`), the trigger
re-locks `points_requested`, `usd_amount`, `phone_number`, `user_id`, and
`requested_at` to their original values — only `status`, `processed_by`,
and `admin_note` may actually change. There is no delete policy on this
table at all; financial records aren't deleted.

## The admin side is a record-keeping step, not a payment rail

Nothing in this codebase moves money. The flow is: a user requests a
payout → an admin manually sends the Wish Money transfer to the phone
number shown on the Reward Program tab (Zabetna admin, `/rewards`) →
**only after that transfer has actually been sent**, the admin presses
"Confirm" in the admin panel, which just updates `status = 'confirmed'`
and `processed_by`. There is no integration with Wish Money's own systems
— confirming in the admin panel does not trigger a transfer, it records
that one already happened. Getting this order backwards (confirming
before sending) would create a mismatch between what the database says
happened and what actually happened at Wish Money, with no automated way
to catch it.

## Permissions

- `users.view` (existing permission) gates both the Users tab and reading
  the Reward Program tab — same permission that already gates reading
  `profiles`.
- `rewards.manage` (new, `supabase/migrations/0016_rewards_program.sql`)
  is required to actually press Confirm/Reject. It's deliberately
  narrower than `users.view` and, as seeded, granted to **Super Admin
  only** — this represents authorizing that a real transfer was made, not
  just viewing account data. Grant it to another role via
  `role_permissions` once the Admins UI exists (still on blueprint.html's
  "still to build" list).

## Bug caught and fixed before shipping: `redemptions_admin_read` was too narrow

`public.user_points_summary` (the view backing the Users tab) is declared
`security_invoker = true`, so its `redemption_count` / `points_earned` /
`points_available` / `available_usd` columns are computed under the
*querying admin's own* RLS — not the view owner's. The pre-existing
`redemptions_admin_read` policy only admitted `has_permission('reports.view')`.
The **Support Agent** role has `users.view` but not `reports.view` — so a
Support Agent opening the Users tab would have seen every user's
redemption/points numbers silently show as **0**, not an error, just
wrong. Only Super Admin (who holds every permission) would ever have seen
correct numbers, which is exactly the kind of bug that hides behind "it
worked when I tested it" if the person testing happens to be a Super
Admin. Fixed in `supabase/migrations/0017_redemptions_users_view_access.sql`
by adding `users.view` as an alternate qualifying permission on that
policy — reading redemptions to compute a user's own points summary is
exactly what the Users tab is for. This does mean a `users.view`-only
admin can now also query `public.redemptions` directly, not just through
the view; that widening is intentional, not incidental. Verified directly
against the live database by simulating a Support-Agent-only session
inside a rolled-back transaction and confirming non-zero figures came
back (see the migration's own comment for the reasoning).

## What's still missing before this is real

1. **User App "Redeem" button doesn't exist.** The User App itself hasn't
   been built. Whoever builds it needs to: show the user's available
   balance (query `user_points_summary` — it's already granted `select`
   to `authenticated` and is `security_invoker`, so a user querying it
   sees only their own row via the existing `profiles`/`redemptions` RLS);
   let them submit an insert into `reward_redemption_requests` with no
   client-supplied amount fields (the trigger fills them in and will
   reject anything that isn't a real 40+-point balance); lock the button
   to their own profile phone number (not a separately-entered number —
   that's already enforced server-side, but the UI should make clear
   *why* it's locked, and should tell the user to add a phone number to
   their profile first if it's empty, since the insert will otherwise be
   rejected with exactly that message); and show the message **"Redemption
   takes 24 to 72 hours, weekdays only"** after a request is submitted.
2. **No user-facing notification when a request is confirmed.** Mo's
   request explicitly includes "users get a notification that points
   redeem" — there is no push-notification infrastructure anywhere in
   this codebase (confirmed by searching the repo). This is a real gap,
   not an oversight: it needs to be built (push notifications, or at
   minimum an in-app "your payout was sent" state visible next time the
   user opens the app) before this requirement is actually met. Until
   then, a user has no way to know their request was processed except by
   noticing the Wish Money transfer itself.
3. **No admin invite/role-assignment UI yet** (same gap noted in
   blueprint.html and vendor-app-fee-reporting.md) — `rewards.manage` can
   currently only be granted by directly editing `role_permissions` in
   the database.

## Demo data note

As of 2026-08-30, none of the 12 demo users has crossed the 40-point
minimum (the highest is 23 points / $5.75) — the Reward Program tab
correctly shows empty across every status tab. This wasn't padded with
extra synthetic redemptions to manufacture a demo, since that would mean
fabricating activity beyond what's needed to demo the Reports feature it
was originally seeded for (see `0013_seed_demo_redemptions.sql`). If a
populated demo is wanted, the honest way to get one is either genuinely
using the app or deliberately deciding to extend the seed data — not
something to do silently.

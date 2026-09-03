# Points / rewards program design (2026-08-30)

**Status:** Schema, triggers, the admin-side Users + Reward Program tabs,
and the User App side are all built and live. The User App side (a "Redeem" button, balance display,
and the "24–72 hours, weekdays only" processing message) was **built on
2026-09-02** — see `docs/2026-09-02-user-app-rewards-screen.md`. What is
still missing is push *delivery* setup (`eas init` + a Database Webhook);
the notification itself now exists (item 2 below). This doc remains the record of the money-affecting decisions made
so a later change doesn't accidentally reintroduce a correctness bug that
was deliberately designed around.

## The business rule, in one paragraph

Every **verified** redemption earns the user 1 point. 1 point = $0.25 USD.
A user can request a payout once their available balance is at least 40
points ($10.00) — below that, a request is rejected server-side before it
is ever created. Confirmed with Mo, 2026-08-30. There is no partial
cash-out: pressing "Redeem" always requests the user's *entire* available
balance in one request, not a chosen amount — matching a single button
with no amount picker. Since 2026-09-03 every request also carries a flat
**$1.00 service fee**, withheld from the cash, and the number must be
**OTP-verified first** — see the next section.

## Phone verification and the service fee (2026-09-03)

Two rules added by Mo:

> **Currently OFF (2026-09-03).** Verification is behind
> `app_settings.reward_phone_verification_required`, seeded `false`, so the
> User App / Restaurant App / Admin Panel can be tested end to end before an
> SMS provider exists. The screen, RPC, reset-on-change trigger and column
> privileges are all built and tested; only the gate is skipped. **The $1.00
> fee is NOT behind the flag and applies now.** To turn verification on once
> Twilio/MessageBird is configured — no code change:
>
> ```sql
> update public.app_settings set value = 'true'::jsonb
>  where key = 'reward_phone_verification_required';
> ```

1. **Verification happens at payout time, not signup.** When a user has
   enough points and presses Redeem, they confirm their number by SMS
   before the request can be created. Signup still collects the number; it
   simply isn't trusted until this step. Verifying at payout rather than
   signup means an SMS is only ever paid for by someone actually cashing
   out, not by every account that may never reach the minimum.
2. **$1.00 service fee per submission**, deducted from the cash. The first
   submission's fee also covers the OTP — **users are never charged
   twice**. Confirmed explicitly: 40 points = $10.00 gross, less $1.00 =
   **$9.00 received**, on the first payout and every one after it.

### How it is enforced

- `profiles.phone_verified_at` (0025). Null means unverified.
  `set_reward_request_amounts()` refuses to create a request while it is
  null, in the same trigger that locks the amounts — so no client can route
  around it. Since 0028 that check is conditional on
  `reward_phone_verification_required()`, which **fails safe**: if the
  setting row is ever missing, it returns true and verification is demanded
  rather than skipped. The User App reads the same function, so the client
  and the database can never disagree about whether the step applies.
- **Verification dies with the number it was for.**
  `trg_profiles_phone_change_resets_verification` nulls
  `phone_verified_at` whenever `phone` changes. Otherwise a user could
  verify one number, switch to another, and be paid at a number nobody
  proved they control.
- **The app cannot mark itself verified.** `public.sync_verified_phone()`
  (0026) is the only sanctioned writer, and it ignores its caller entirely
  — it copies `phone` and `phone_confirmed_at` out of `auth.users`, where
  GoTrue records a genuine `verifyOtp`. It also does the two updates as
  separate statements, because the reset trigger above would otherwise null
  the stamp being set in the same statement.
- **Column privileges close the direct route** (0027). `profiles_self_rw`
  grants a user their whole row, which after 0025 meant they could simply
  `update profiles set phone_verified_at = now()`. Table-level UPDATE is
  now revoked from `authenticated` and re-granted per column
  (`full_name, phone, avatar_url, locale, gender, date_of_birth`).
  Verified over the live API: that PATCH returns `42501 permission denied`,
  while a name change still returns 204. The same change incidentally
  stopped a suspended user setting their own `status` back to `active`.
- **The fee is stored per request**, not read from a constant at display
  time — `service_fee_usd` and `net_usd_amount` on
  `reward_redemption_requests`, locked at insert and re-locked by
  `guard_reward_request_transition()` on the one allowed status change.
  Same principle as `redemptions.fee_amount_usd`: a request must keep
  saying what *it* charged even after the rate changes. A check constraint
  enforces `net_usd_amount = usd_amount - service_fee_usd`, and another
  requires the net to be positive.

### What the admin must send

**`net_usd_amount`, not `usd_amount`.** The Reward Program tab now shows
Points value / Fee / **Send this amount** as three columns, and the confirm
dialog names the exact figure and destination, because sending the gross
would overpay every user by $1.00. `user_points_summary.lifetime_paid_usd`
was also switched to sum the **net** — it is displayed as "paid", and
paying $9.00 while reporting $10.00 would misstate real money.

## Payouts are locked and computed server-side, never trusted from the client

`reward_redemption_requests.points_requested` / `usd_amount` /
`phone_number` are entirely overwritten by a `BEFORE INSERT` trigger
(`set_reward_request_amounts()`, `supabase/migrations/0016_rewards_program.sql`)
regardless of what a client sends in the insert payload. The trigger:

1. Reads the user's own `profiles.phone` — **not** anything the request
   payload says — and rejects the request if it's empty (a phone number is
   required before a payout can be requested, since that's the Wish Money
   transfer destination). Since 0025 it also rejects the request if
   `profiles.phone_verified_at` is null.
2. Computes `available = (verified redemptions) - (points already
   reserved by a pending request, or already paid by a confirmed one)`. A
   *rejected* request releases its points back to the pool — this is why
   `reserved_or_paid` filters `status <> 'rejected'` rather than summing
   everything.
3. Rejects the insert outright if `available < 40`.
4. Sets `points_requested = available`, `usd_amount = available * 0.25`
   (gross), `service_fee_usd = 1.00`, `net_usd_amount = usd_amount - fee`,
   `phone_number` = the profile's real phone, and forces `status =
   'pending'`. It also refuses outright if the gross would not exceed the
   fee — impossible at today's $10.00 minimum, but a guard against a future
   fee rise silently creating a zero or negative payout.

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
re-locks `points_requested`, `usd_amount`, `service_fee_usd`,
`net_usd_amount`, `phone_number`, `user_id`, and `requested_at` to their
original values — only `status`, `processed_by`,
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

1. ~~**User App "Redeem" button doesn't exist.**~~ **Built 2026-09-02** —
   `apps/user-app/src/screens/RewardsScreen.tsx` +
   `apps/user-app/src/lib/rewards.ts`, see
   `docs/2026-09-02-user-app-rewards-screen.md`. It does everything listed
   below: balance from `user_points_summary`, an insert carrying only
   `user_id`, the phone-number prompt, the 40-point minimum surfaced
   before the button is pressable, and the 24–72 hours message. The
   original requirement text is kept here as the record of what it had to
   do: show the user's available
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
2. ~~**No user-facing notification when a request is confirmed.**~~
   **Closed 2026-09-02** — `0022_user_notifications.sql` adds a
   `notifications` table written by a trigger in the same transaction as
   the status change (so it cannot be lost), plus `push_tokens` and the
   `send-push` edge function for push delivery on top. Push still needs
   `eas init` and a Database Webhook before it fires; the in-app inbox
   works without them. See `docs/2026-09-02-user-app-build.md`. Original
   requirement kept below. Mo's
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

**Update 2026-09-02:** a single, clearly-labelled QA account
(`rewards.qa@zabetna.test`, profile name "ZZ TEST — Rewards QA") was seeded
with exactly 40 points by `0023_seed_rewards_test_account.sql`, with Mo's
approval, so the payout flow could be tested before it ran against a real
user's money. It adds $0.00 to the Reports fee totals. Delete it before
launch — instructions are in that migration's header. The original note,
which still describes every *real* demo user, follows.

As of 2026-08-30, none of the 12 demo users has crossed the 40-point
minimum (the highest is 23 points / $5.75) — the Reward Program tab
correctly shows empty across every status tab. This wasn't padded with
extra synthetic redemptions to manufacture a demo, since that would mean
fabricating activity beyond what's needed to demo the Reports feature it
was originally seeded for (see `0013_seed_demo_redemptions.sql`). If a
populated demo is wanted, the honest way to get one is either genuinely
using the app or deliberately deciding to extend the seed data — not
something to do silently.

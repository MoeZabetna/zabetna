# User App: built for testing (2026-09-02)

Follows `docs/2026-09-02-user-app-rewards-screen.md`, which ended with two
open items and a blocked Figma. Mo upgraded Figma (now **tier `pro`, seat
`Full`** — 200 tool calls/day, 10/min, confirmed via `whoami`) and asked for
both open items fixed and the User App built properly and testable. This is
what was done, what was found on the way, and what is still not true.

## What the app is now

Signed-out, it opens on Sign In. Signed-in, it is a four-tab app with a
push-capable notification inbox and a working redemption loop:

| Area | State |
|---|---|
| Auth | Sign In + Sign Up, real Supabase auth, session persisted |
| Home | Real categories + featured shops from Supabase, pull-to-refresh |
| Categories | Category grid → shops in that category → shop detail |
| Shop Detail | Shop info + its live offers, each with "Redeem Now" |
| Redeem | `create-redemption` → QR + manual code + expiry countdown → polls for the shop's verification → confirms |
| Rewards | Balance, payout request, pending-request state, blocked-reason states |
| Profile | Editable name/phone, redemption overview, notifications link, sign out |
| Notifications | In-app inbox, unread badge, push registration |

`npx tsc --noEmit` is clean and `npx expo export --platform ios` produces a
3.9MB bundle.

### Verified against the live database, not just compiled

Compiling proves nothing about RLS, so the client path was exercised
directly against the REST API the app uses:

| Check | Result |
|---|---|
| Anonymous read of `categories` | 3 returned — public read works unauthenticated |
| Anonymous read of `shops` | 19 visible, seeded TEST shop correctly **not** among them |
| Password sign-in as the QA account | access token issued |
| `user_points_summary` as that user | exactly one row — their own — 40 points / $10.00 |
| `phone_available('+961700000000')` | `false`, i.e. correctly reports the number as taken |

The payout chain was tested separately inside a transaction that was then
deliberately aborted, so nothing was left behind: inserting a request with
**only `user_id`** produced a locked 40 points / $10.00, confirming it wrote
the notification *"Your payout was sent — We sent $10.00 to +961700000000
via Wish Money"*, and the balance correctly dropped to 0 while reserved.
Post-rollback: 0 requests, 0 notifications, 40 points restored.

## Gap 2 is closed: users now find out

`docs/rewards-program.md` listed "no user-facing notification when a request
is confirmed" as a real gap. It is now two layers, deliberately ordered:

1. **The inbox is the guarantee.** `0022_user_notifications.sql` adds a
   `notifications` table written by triggers *in the same transaction* as
   the event — payout confirmed, payout rejected, and (new) a point earned
   when a shop verifies a redemption. Because it commits with the status
   change, it cannot be lost. Users cannot insert into it: every row comes
   from a `SECURITY DEFINER` trigger, so no client can fabricate a "your
   payout was sent" message.
2. **Push is best-effort delivery on top.** `supabase/functions/send-push`
   (deployed, ACTIVE) sweeps unpushed rows and sends them via Expo, drops
   tokens Expo reports as `DeviceNotRegistered`, and marks rows pushed —
   including rows for users with no device, so they don't become permanent
   retry candidates.

Push fails for reasons outside our control — permission declined, token
expired, device offline, APNs having a bad day — and none of those may cost
someone the message. Worst case degrades to "they see it next time they
open the app", never "they never find out".

**Still needs one manual step:** push tokens require an EAS project.
`registerForPush` returns a `skipped` reason rather than an error until
`eas init` is run in `apps/user-app`, and `send-push` needs to be invoked
by a Database Webhook on `notifications` INSERT (or a scheduled job) with
the service role key. Until both are done, the inbox works and push does
not. That is a setup task, not a code gap.

## Two defects found and fixed along the way

**1. A migration existed in production but not in the repo.**
`shop_staff_identity` (version `20260830172737`) was applied to the live
database on 2026-08-30, but its file was never committed. `pnpm db:reset`
would have rebuilt a database *missing the two columns the Restaurant App's
staff login reads* — the exact class of "works in prod, broken from
scratch" drift that is invisible until someone rebuilds. Recovered verbatim
from `supabase_migrations.schema_migrations.statements` and committed as
`0020_shop_staff_identity.sql`.

**2. Nothing ever created a `profiles` row.** Every profile in the database
arrived from a seed script, because the only accounts that existed were
seeded demo users and admins. The first real signup would have created an
`auth.users` row with no profile — and then been permanently unable to
redeem points, since `set_reward_request_amounts()` reads `profiles.phone`.
Fixed in `0021_user_signup_profile.sql` with a `handle_new_user` trigger.
It keys off the signup metadata carrying both `full_name` and `phone`, so
admins and shop staff (also `auth.users` rows) don't get consumer profiles
and end up in the Users tab and points program.

That migration also adds `phone_available(text)`. `profiles.phone` is
UNIQUE — deliberately, since it's a payout destination and two accounts
sharing one makes a transfer ambiguous — which meant a duplicate at signup
surfaced as an opaque *"Database error saving new user"*. The Sign Up
screen now checks first and says which field is wrong. The function returns
a boolean only; it never reveals whose number it is.

## The auth decision changed after reading the design

Mo was asked to choose an auth channel and picked "Email OTP now,
phone-ready", based on my description of the Figma auth screens as
phone-based. **Reading the actual frames showed that was wrong**, so the
build does something different and better matched:

- Sign in (36:956) is **Email + Password** with a "Forgot password" link.
- Sign Up (36:994) collects **Name, Email, Phone number, Password**.
- "verify your number" (36:707) / "verified" (36:835) are a *phone
  verification step after sign-up*, not the sign-in mechanism.

So the app implements email + password exactly as designed — which also
satisfies the constraint behind Mo's answer (works today, no SMS cost).
The phone number is collected and stored because payouts need it, but it is
**not verified**, and the two verification frames are deliberately not wired
up: verifying a number means sending an SMS, which needs a paid provider in
the Supabase dashboard. Nothing in the UI claims a number has been verified
when it hasn't. Wiring those two frames is a small job once Twilio exists.

Sign-up handles both Supabase "Confirm email" settings: with confirmations
on, `signUp` returns no session and the UI says to check the inbox; with
them off, the returned session signs the user straight in.

## Design fidelity

Auth screens were built from `get_design_context` on the real nodes, not
from memory. The logo is a **3× PNG export of node 39:2031** (464×540 for
the designed 154×180 box) rather than redrawn: the mark is six overlapping
gradient vectors with a `mix-blend-multiply` layer, and the wordmark is set
in "Dortage", a font this project has no copy of or licence for.

Two button shapes now exist and that is correct, not an inconsistency: the
auth CTA is 56px at radius 45 (Figma 36:986), the in-app CTA is 48px at
radius 8 (the Redemption Confirmation screens).

The Rewards Screen frame (`4016:192`) is **still an empty placeholder** —
now that Figma is upgraded it can be drawn, and `RewardsScreen.tsx` says in
its header comment that it is the thing to reconcile against.

## Environment: iCloud eviction, fixed properly this time

The previous session's build failures were traced to iCloud evicting
`node_modules` file contents (`dataless` stubs) under Desktop & Documents
sync, making reads time out. That was cured by hand. It is now prevented:

- Dependency and build directories carry the
  `com.apple.fileprovider.ignore#P` xattr, so iCloud stops syncing — and
  therefore stops evicting — them.
- `scripts/icloud-guard.sh` does `exclude` (prevent), `repair` (cure), and
  `check` (report), wired up as `pnpm icloud:check|repair|exclude`.

**Re-run `pnpm icloud:exclude` after any `rm -rf node_modules`** — a fresh
directory doesn't inherit the flag. The permanent fix remains moving the
repo off `~/Desktop`.

## Superseded 2026-09-03: phone verification moved to payout time

The section above says the "verify your number" / "verified" frames are
deliberately unwired and that phone numbers are unverified. That is still
true *of signup* — but the frames now have a home. Mo's decision, same day:

- Verification happens **at payout time**, when the user has the points and
  is about to have money sent to the number.
- Every payout carries a **$1.00 service fee**; the first one's fee also
  covers the OTP, so nobody is charged twice.

Built: `VerifyPhoneScreen.tsx` from Figma node 36:707 (illustration exported
at 3x from node 36:711, 816x743 for its designed 272x247 box), reached from
the Rewards screen's CTA when the number is unverified. Migrations
0025-0027 carry the rules. Full detail is in `docs/rewards-program.md`.

**This makes an SMS provider a hard requirement for testing the payout
path** — see below.

## What is still not true

1. **`eas init` + a Database Webhook are needed for push.** In-app
   notifications work without them.
2. **Phone OTP is switched off for now** (`app_settings
   .reward_phone_verification_required` = `false`, 0028), at Mo's request,
   so the three surfaces can be tested in sync before an SMS provider
   exists. The manual `phone_verified_at` bypass below is therefore *not*
   needed while the flag is off. Original note, which applies again once it
   is flipped on:
   The flow, screen and server-side rules are built and verified, but
   `auth.updateUser({ phone })` cannot send anything until Twilio (or
   MessageBird) is configured in the Supabase dashboard under
   Authentication -> Providers -> Phone. Until then the Redeem button leads
   to the Verify screen and the code never arrives.

   To exercise the *payout* half before that is set up, mark the QA account
   verified by hand — this deliberately bypasses a security control, so it
   is a one-off testing step, not something to script:

   ```sql
   update public.profiles
      set phone_verified_at = now()
    where phone = '+961700000000';
   ```

   Note it must be run as the service role / SQL editor: the
   `authenticated` role is specifically forbidden from writing that column
   (0027).
3. **Screens still unbuilt**: Splash/Onboarding (5 frames), Language,
   Shops (all-shops list), Menu, Settings, Help/Support. Home, Categories,
   Shop Detail, Redeem, Rewards, Profile, Notifications and both auth
   screens exist. Splash is currently a logo + spinner, not the designed
   frame.
4. **`pnpm types:generate` was not run** — it needs `supabase login`, which
   is interactive. `packages/shared-types/src/database.ts` therefore does
   not yet include `notifications` / `push_tokens`. Nothing depends on it:
   the new data-layer modules type their own row shapes. Run
   `supabase login`, then `pnpm types:generate`.
5. **The QA test account is real data and must be deleted before launch.**
   `rewards.qa@zabetna.test`, and a `pending` shop and `draft` offer, all
   prefixed "ZZ TEST". Its 40 redemptions add **$0.00** to Reports (the
   test shop's `value_per_redemption` is 0) — the fee total is still
   exactly $620.00, verified after seeding — but they do add 40 rows to the
   redemption *count*, which is unavoidable because points literally are
   that count. Removal is two statements, in
   `0023_seed_rewards_test_account.sql`'s header.

## How to test it

```bash
pnpm icloud:check          # if this reports evicted files, run pnpm icloud:repair
pnpm user-app              # expo start
```

Sign in with `rewards.qa@zabetna.test` / `ZabetnaTest!2026` — that account
has exactly 40 points ($10.00), the payout minimum, so the Redeem button is
live. Confirming the request from the Admin Panel's Reward Program tab
writes the notification that appears in the app's inbox.

To test the *earning* half instead, sign up a fresh account, browse to a
shop, tap Redeem Now, and have the Restaurant App verify the code — the
point lands and a "You earned a point" notification appears.

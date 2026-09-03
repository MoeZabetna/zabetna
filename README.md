# Zabetna

Discount platform: **User App**, **Restaurant App** (merchant verification),
and **Admin Panel** (onboarding, content, reporting, RBAC), sharing one
Supabase backend.

Read [`docs/blueprint.html`](docs/blueprint.html) first — it's the actual
spec (architecture, data model, redemption flow, admin roles, roadmap). This
README is just how to run what's here.

## Layout

```
apps/
  user-app/        Expo (React Native) — consumers
  restaurant-app/   Expo (React Native) — shop staff, QR verification
  admin/            Next.js — operations
packages/
  shared-types/     Types shared by all three apps (Supabase-generated + domain types)
  api-client/       Supabase client + typed calls to the redemption edge functions
supabase/
  migrations/       SQL schema, applied in order
  functions/        Edge functions (create-redemption, verify-redemption)
docs/
  blueprint.html    The actual spec
```

## Status

Supabase project `albnccpmvwocmizxgfoh` (ap-south-1) is live: full schema +
RLS applied, 8 categories seeded, 19 real Beirut demo shops seeded across all
categories, one bootstrap Super Admin account. Security advisor is clean
except one item that needs a human: **leaked-password protection is
disabled** — toggle it in the Supabase dashboard under Authentication →
Policies; no MCP/API tool exposes that setting.

**Admin Panel**: all nine sections are live and verified with `next build`
— login (RBAC-aware), Categories, Shops (incl. banner/menu uploads and
per-shop staff logins), Offers, Banners, Users, Rewards, Reports (Overall +
Daily Performance), and Admins (invite/roles/suspend). Nothing is a
"Coming Soon" stub any more.

**User App**: testable end to end. Sign In / Sign Up (real Supabase auth,
session persisted), Home and Categories on live Supabase data, Shop Detail,
the QR redemption flow (`create-redemption` -> QR + manual code + expiry
countdown -> verification), Rewards, Profile and a notification inbox. Built
with React Navigation. Verified with `npx tsc --noEmit` and `npx expo export`
(3.9MB bundle), and the client path exercised directly against the live REST
API. Still unbuilt: Splash/Onboarding, Language, all-shops list, Menu,
Settings, Help/Support. See `docs/2026-09-02-user-app-build.md`.

To run it you need `apps/user-app/.env` — copy `.env.example` and fill in the
Supabase URL and anon key.

**Restaurant App**: login (gated on an active `shop_staff` row, not just a
valid Supabase Auth session), QR + manual redeem screen, and per-shop
reports are built.

**Rewards payouts** (updated 2026-09-03): a payout requires the user's phone
number to be **OTP-verified at payout time** (not at signup), and every
request carries a flat **$1.00 service fee** — 40 points = $10.00 gross,
$9.00 received. The first payout's fee also covers the OTP; nobody is
charged twice. Admins must transfer the **"Send this amount"** column on the
Reward Program tab, not the points value. Sending the OTP needs an SMS
provider configured in Supabase (Authentication → Providers → Phone), so
verification is currently **switched off** via
`app_settings.reward_phone_verification_required` (seeded `false`) to allow
end-to-end testing — the fee still applies. Flip that row to `true` once an
SMS provider exists; no code change. See `docs/rewards-program.md`.

**Notifications**: `notifications` + `push_tokens` tables with triggers that
write a user-facing message in the same transaction as the event (payout
confirmed/rejected, point earned), plus the `send-push` edge function
(deployed). Push delivery additionally needs `eas init` in `apps/user-app`
and a Database Webhook — until then the in-app inbox works and push doesn't.

**zabetna.com**: registered, but not connected to this Supabase project or
to any current Vercel project in this account. Needs a decision — point the
existing domain here, or buy a new one — before launch.

See §01, §06, §07, §08 of the blueprint for the full detail and the product
questions still open.

`.env` files are **not** committed (they're gitignored in every app,
`apps/admin` included) — this line previously claimed they were already
committed for all three apps, which was never true and caused a real
outage: the Admin Panel's Supabase URL and anon key only ever existed in
`apps/admin/.env.local` on developer machines, so the first Vercel
deployment that actually built successfully still 500'd at runtime until
the same two values were added as Vercel Environment Variables by hand.
See `docs/incidents/2026-08-30-admin-panel-outage.md`, root cause 5. To
run any app locally, copy `.env.example` (if present) or ask for the
current Supabase URL and publishable (anon) key — that key is meant to be
public in a client bundle, so sharing it isn't a secret leak, but it
should still be rotated before this repo ever goes to a public host.

## Setup

This repo lives under `~/Desktop`, which iCloud syncs — and iCloud evicts
`node_modules` file contents, which makes builds fail with a confusing
`ETIMEDOUT` on a local path. `pnpm icloud:exclude` prevents it (re-run after
any `rm -rf node_modules`); `pnpm icloud:repair` cures it if a build is
failing right now. Details in `docs/2026-09-02-user-app-rewards-screen.md`.

```bash
pnpm install
pnpm user-app             # expo start — Home Screen renders
pnpm restaurant-app        # expo start — staff login, redeem, reports
pnpm admin                  # next dev — Categories + Shops management live

pnpm types:generate      # regenerate packages/shared-types/src/database.ts after any schema change
pnpm db:push              # apply new supabase/migrations
```

### Admin Panel login

The bootstrap Super Admin can sign in at `/login` with
`muhamad.itani@gmail.com` and the temporary password set in
`supabase/migrations/0004_bootstrap_super_admin.sql` — change it after first
login (there's no self-serve reset flow yet; use the Supabase dashboard in
the meantime).

## Deployment (Admin Panel)

Hosted on Vercel, project `zabetna-admin-v2`, connected to this GitHub repo
(`MoeZabetna/zabetna`, production branch `master`). Since this is a
monorepo, Vercel's **Root Directory must be `apps/admin`** and **Framework
Preset must be `Next.js`** (both are project settings, not files in this
repo — check them in the Vercel dashboard if a deploy ever 404s sitewide
with a clean build). A parallel Render config also exists
(`render.yaml`, service `zabetna-admin`) as a fallback host, not currently
the primary.

If anything about deploys here looks broken, read
[`docs/incidents/2026-08-30-admin-panel-outage.md`](docs/incidents/2026-08-30-admin-panel-outage.md)
first — it's a real postmortem of a ~12-hour outage on this exact app and
covers three separate root causes that all produced the same "site is
down" symptom.

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

**Admin Panel**: login (RBAC-aware) and Categories (add/edit/delete/reorder/
icon) and Shops (add/edit/delete/category/status/map-picked location) are
live and verified with `next build`. Banners, Reporting, and Admin user
management are stub "Coming Soon" pages, gated behind the same permissions,
not yet implemented.

**User App**: Home Screen is built and bundles successfully (`npx expo
export`, verified). The other 20 screens are not built.

**Restaurant App**: still the default Expo template — not started.

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

```bash
pnpm install
pnpm user-app             # expo start — Home Screen renders
pnpm restaurant-app        # expo start — default Expo template, not yet built
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

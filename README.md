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

Supabase project `albnccpmvwocmizxgfoh` (ap-south-1) is live with the full
schema + RLS applied and passing the security advisor clean. Figma is
connected. The User App's Home Screen is built and bundles successfully
(`npx expo export`, verified). Everything else — the other 20 User App
screens, the whole Restaurant App, and the whole Admin Panel — is still
scaffold only. See §06 and §08 of the blueprint for the real remaining list.

`.env` files with the live project's URL and publishable (anon) key are
already committed for all three apps — that key is meant to be public in a
client bundle, so this isn't a secret leak, but rotate it before this repo
ever goes to a public host.

## Setup

```bash
pnpm install
pnpm user-app             # expo start — Home Screen renders
pnpm restaurant-app        # expo start — default Expo template, not yet built
pnpm admin                  # next dev — default Next.js template, not yet built

pnpm types:generate      # regenerate packages/shared-types/src/database.ts after any schema change
pnpm db:push              # apply new supabase/migrations
```

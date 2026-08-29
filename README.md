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

This is the Phase 0 foundation scaffold — folder structure, schema, and edge
function logic are written; no Supabase project exists yet and the User App
UI hasn't been built against the Figma design. See §06 and §08 of the
blueprint for what's next and what's still open.

## Setup (once a Supabase project exists)

```bash
pnpm install

# .env files per app, from the Supabase project settings:
#   apps/user-app/.env        EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY
#   apps/restaurant-app/.env  EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY
#   apps/admin/.env.local     NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY

pnpm db:push            # apply supabase/migrations
pnpm types:generate      # regenerate packages/shared-types/src/database.ts after any schema change

pnpm user-app             # expo start
pnpm restaurant-app        # expo start
pnpm admin                  # next dev
```

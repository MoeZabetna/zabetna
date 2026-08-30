# Admin management: invite, roles, passwords (2026-08-30)

**Status:** Code is built and passes typecheck/build/lint. The "Add admin"
flow is **not fully usable yet** — it needs a Supabase secret this project
doesn't have configured anywhere (local `.env.local` or Vercel), and this
sandbox has no way to fetch or set that secret on Mo's behalf. See
"What's missing before Add admin actually works" below — this isn't a
code gap, it's a one-time config step only Mo can do.

## What's built

- **Admins tab** (`/admins`, `admins.manage` — Super Admin only as seeded):
  lists every admin, their role, status, and join date; lets a Super
  Admin add a new admin, change another admin's role, and suspend/
  reactivate another admin's access.
- **Change password**: in the header, next to Sign out, for *every*
  signed-in admin regardless of role. Re-verifies the current password
  (via a real sign-in call) before allowing the change — a left-open
  session can't change the password without proving it again.

## Why adding an admin needs a secret this app doesn't have

Creating a real login (someone who can actually sign in) means writing to
Supabase's own `auth.users`/`auth.identities` tables. There are exactly
two ways to do that:

1. **The Supabase Auth Admin API** (`auth.admin.createUser(...)`) — the
   real, supported way. It requires the project's **service-role key**,
   which must only ever live in a server-side environment variable
   (`SUPABASE_SERVICE_ROLE_KEY`, never `NEXT_PUBLIC_*`) — it bypasses
   every RLS policy in the database, so if it ever reached the browser
   bundle, anyone could read or write any row in any table. This project
   has never had this key configured anywhere; only the publishable/anon
   key exists today (`.env.local`, Vercel env vars).
2. **Direct SQL against `auth.users`** — what
   `supabase/migrations/0004_bootstrap_super_admin.sql` did for Mo's own
   account, as a one-time bootstrap. That migration's own comment says
   plainly this isn't the normal way to create a user — it's what you do
   when nothing else can run yet. It's not something the running app can
   do on every "Add admin" click; it only works because I can run it
   directly against the database from this session.

So the code in `app/(dashboard)/admins/actions.ts` uses path 1, correctly
gated — but it will fail with a clear error ("SUPABASE_SERVICE_ROLE_KEY
isn't configured…") until the key exists as a real environment variable.

### What's missing before "Add admin" actually works

1. Go to the Supabase dashboard → Project Settings → API → reveal the
   **service_role** key (labelled "secret", not "publishable").
2. Add it as `SUPABASE_SERVICE_ROLE_KEY` in **two** places:
   - Vercel → the `zabetna-admin-v2` project → Settings → Environment
     Variables (Production, and Preview if you want invites to work
     there too), then redeploy.
   - Local `.env.local` (already gitignored — nothing else needs to
     change) if you ever run the admin panel locally.

**Do not paste this key into chat, a commit, or anywhere in the repo** —
it is a full-database-bypass credential. I can't fetch or set it for
you; Supabase deliberately doesn't expose it through the tools available
in this session, on purpose.

## How "Add admin" works once that's in place

No email-sending capability exists anywhere in this codebase (same gap
as the payout-confirmation notification — see docs/rewards-program.md),
so there's no invite-link email. Instead: creating an admin generates a
strong random temporary password server-side, creates their real login
with it, and shows that password **once**, in the admin panel, to the
Super Admin who just created the account. It is never logged, stored
anywhere, or shown again — the inviting admin has to relay it to the new
admin themselves (Slack, in person, anything other than plaintext
email), and the new admin should use "Change password" the moment they
sign in. This mirrors exactly how Mo's own bootstrap account was set up
(`0004_bootstrap_super_admin.sql`'s "temporary password... change it
after first login").

## Guardrails, and why they're at the database layer

- **Every admin-management action re-checks `admins.manage` itself**,
  not just via RLS. This matters specifically because
  `auth.admin.createUser` bypasses Postgres entirely — RLS can't protect
  an API call that never touches a table through the normal client. If
  that explicit check were ever accidentally removed from
  `actions.ts`, nothing else in the stack would catch it.
- **A database trigger, not just app logic, blocks locking everyone
  out.** `guard_last_admin_manage_holder()`
  (`supabase/migrations/0018_admin_management.sql`) refuses any update
  to `admin_users` that would leave zero active admins holding
  `admins.manage` — whether that's demoting the last holder's role or
  suspending their account. Verified live (rolled back afterward):
  attempting to suspend Mo's own account today — the only admin that
  exists — correctly raises `Cannot remove admin-management access from
  muhamad.itani@gmail.com — they are the only active admin who can
  manage other admins.` A trigger holds even against a direct SQL edit,
  not just clicks in the UI — the same reasoning already used for the
  redemption-fee and reward-payout triggers.
- **The UI additionally blocks editing your own row at all** (role or
  status) — simpler than relying on the trigger's edge-case math, and
  the trigger is still there as the real backstop if that ever changes.
- **`audit_log` finally has a working insert path.** It existed since
  the original schema (`0001_init.sql`) but had no insert policy — every
  admin-management action (invite/role-change/status-change) now writes
  a row there, self-attributed to whoever did it. The policy is scoped
  generally (an admin can log an entry for themselves) rather than
  gated to `admins.manage` specifically, so other features can start
  logging to it later without needing their own policy.

## What's still not covered

- **No "convert an existing app user to admin" flow** — inviteAdmin()
  always creates a brand-new auth account. If someone's email is already
  registered (e.g. as a regular app user), invite fails with a clear
  message rather than doing something surprising; linking an existing
  account to `admin_users` would need to be a deliberate, separate
  decision, not an automatic side effect of clicking "Add admin."
- **No self-service "forgot password"** — only a signed-in admin can
  change their own password (it requires re-entering the current one).
  A locked-out admin still needs a Super Admin to intervene manually
  (there is no reset-by-email flow, same missing-email-service gap as
  above).
- **`audit_log` isn't wired up anywhere else yet** — shops, offers,
  banners, and reward-payout confirmations don't write to it. This
  migration only closes the "nothing can write to it at all" gap;
  extending logging to those features is separate future work.

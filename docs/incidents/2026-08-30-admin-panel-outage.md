# Incident: Admin Panel down for ~12 hours (2026-08-30)

**Status:** Resolved and verified end-to-end. All five root causes below
are fixed. The first real GitHub-triggered build succeeded
(`dpl_6fL9iUUMggMjdTMv9oKcTDkwAiX4`, commit `79db288`), and — once root
cause 5 (missing runtime env vars) was found and fixed — a redeploy of
that same commit (`dpl_7BLmQZMPLpKMa5kEqoAUUcr8f2Rz`) is `READY`, aliased
to `zabetna-admin-v2.vercel.app`, and confirmed serving `/`, `/login`,
`/shops` with HTTP 200 and zero runtime errors in the last 10 minutes of
logs.

**Important nuance:** production (`zabetna-admin-v2.vercel.app`) kept
serving correctly (verified `/login`, HTTP 200) throughout root cause 4 —
Vercel does not swap the live alias onto a deployment that fails to build,
it keeps serving the last successful one. That masked two things at once:
first, that production hadn't yet been proven to build from what was
actually on GitHub (the last successful deploy, `dpl_8QYuNefrHVVTsgtX3ytGBk8gHVUJ`,
was a direct CLI upload); second, once the GitHub build *did* succeed, it
immediately 500'd on every route at runtime — a bug that had been latent
the entire incident because every previous deploy attempt failed before
ever reaching runtime. "Site is up" was never the same fact as "the
GitHub pipeline works," and "the build succeeded" was never the same fact
as "the app runs." This incident hit all three gaps in sequence.

This doc exists so nobody — human or Claude — has to re-derive any of
this from scratch next time something in this pipeline breaks.

## Summary

A change to `apps/admin` (a day-of-week column + related logic on offers)
was followed by a Vercel deploy that crashed. What looked like "one bad
deploy" turned out to be **four independent, stacked failures** across the
app's dependency on Next.js 16 conventions, how this project was hosted on
Vercel, whether the code was even on GitHub, and — once it finally was —
how pnpm behaves on Vercel's build image for a monorepo. Fixing one wasn't
enough — the site (or the build) kept failing in a different way after
each fix, which is why this took so long instead of minutes. Read this
before assuming a Vercel 404 or crash here is a one-line fix.

## Root causes, in the order they were found

### 1. `middleware.ts` → Edge Runtime crash (`ReferenceError: __dirname is not defined`)

Next.js 16 still accepted `middleware.ts`, but it defaults to the Edge
runtime, and this app's bundling under Edge crashed production with
`__dirname is not defined` — reproduced even with a fully empty middleware
function, so it was not this app's code, it was Next 16 + Edge bundling.

**Fix:** renamed `apps/admin/middleware.ts` → `apps/admin/proxy.ts`, the
Next 16 convention
([docs](https://nextjs.org/docs/app/guides/upgrading/version-16#middleware-to-proxy)).
`proxy.ts` forces the Node.js runtime unconditionally — no Edge, no
`__dirname` bug. See the comment at the top of `apps/admin/proxy.ts` for
the full detail.

### 2. Vercel Framework Preset not set → sitewide 404 with **zero** function invocations

After fix #1, the build was clean (`ƒ Proxy (Middleware)` correctly
recognized, all routes listed) — but production still 404'd on every
route, and Vercel's runtime logs showed **zero invocations**, meaning
requests never reached a function at all. This is a platform-level Vercel
routing failure, not an app bug — confirmed against Vercel's own
[Knowledge Base](https://vercel.com/kb/guide/why-is-my-deployed-project-giving-404):
an unrecognized Framework Preset (`"framework": null` / "Other" in project
settings) skips framework-specific routing-manifest generation.

**Fix:** Vercel Dashboard → Project Settings → Build and Deployment →
Framework Preset → set explicitly to **Next.js**, then Save. This is a
**project setting**, not something in this repo — if this app is ever
redeployed under a new Vercel project, or the setting somehow gets unset
again, this exact symptom (clean build, 404 everywhere, zero invocations)
will come back. Check this setting first if it does.

### 3. The GitHub repo (`MoeZabetna/zabetna`) was completely empty

This one wasn't caused by this incident — it predates it — but it meant
every "deploy" this whole time was a direct file upload to Vercel from a
sandbox/CI environment, not a real `git push`. Nothing was actually on
GitHub. The Vercel↔GitHub connection existed for the project but pointed
at a repo with zero commits, so it was a no-op.

**Fix:** the real repo, full history, was bundled (`git bundle create
--all`) and handed to the human to push manually, because the environment
doing the diagnosis did not have push credentials for this repo (see
"Tooling limitation" below). Once pushed, `zabetna-admin-v2`'s Vercel
project is connected to `MoeZabetna/zabetna` and **Root Directory should
be `apps/admin`** (this is a monorepo — the admin app is not at repo
root). Confirm that setting is correct after the first GitHub-triggered
deploy; it may need to be set manually the same way the Framework Preset
did.

### 4. pnpm on Vercel's build image, for this monorepo: three stacked issues

Once root cause 3 was fixed and GitHub had real commits, the first
GitHub-triggered build hit a **new** set of failures — nothing to do with
app code, all specific to running `pnpm install`/`pnpm build` for a
monorepo on Vercel with Root Directory set to `apps/admin`.

**4a. Zero-config detection doesn't find the lockfile.** With Root
Directory = `apps/admin`, Vercel's package-manager auto-detection looks
for a lockfile *inside* `apps/admin`. This repo's `pnpm-lock.yaml` lives
at the true repo root (it's a workspace lockfile covering `apps/*` and
`packages/*`), so Vercel fell back to plain `npm install`, which can't
parse the `workspace:*` protocol this repo uses for its internal
packages (`@zabetna/shared-types`, `@zabetna/api-client`) and failed with
`Unsupported URL Type "workspace:"`.

**Fix:** Project Settings → Build and Deployment → enable "Include files
outside the Root Directory in the Build Step", and set explicit Install
and Build Command overrides (see 4c for the final form).

**4b. Vercel's build image ships a legacy global pnpm ahead of corepack.**
`/pnpm6/node_modules/.bin/pnpm` (v6.35.1) sits on `PATH` ahead of
corepack's shim. This repo's `pnpm-lock.yaml` is `lockfileVersion: '9.0'`,
which pnpm v6 cannot parse at all — but instead of erroring, it silently
no-op'd ("Already up-to-date" in under 2 seconds, no packages
downloaded, no `node_modules` created in the workspace packages). This
looked exactly like a successful-but-empty install and was the reason
the very next step ("No Next.js version detected") was so confusing —
several iterations were spent ruling out caching and stale `node_modules`
before the actual cause (wrong pnpm binary) was found.

**Fix:** use corepack's direct-invocation syntax, `corepack pnpm@latest
<args>`, instead of bare `pnpm`. This bypasses whatever pnpm is on `PATH`
and forces a modern, lockfile-9.0-compatible pnpm regardless of what
Vercel's image ships globally.

**4c. Vercel's build filesystem is not a nested path.** The natural
assumption — that with Root Directory = `apps/admin` and "include outside
files" enabled, the build's cwd is something like
`<repo-root>/apps/admin` — is **wrong**. Vercel actually creates two
*sibling* directories: `/vercel/path0` (the full repo checkout, i.e. the
true repo root) and `/vercel/path1` (the Root Directory context, where
Install/Build Command actually start). So `cd ..` from the starting cwd
lands at `/vercel` (not useful) and `cd ../..` lands at `/` (filesystem
root — this produced a separate, misleading `ERR_PNPM_NO_PKG_MANIFEST: No
package.json found in /` failure). The correct relative path from the
build command's starting cwd to the real repo root is **`cd ../path0`**.
This is undocumented behavior as far as we could find — verified
empirically with an `ls -la` diagnostic in the Install Command.

**Combined fix for 4a–4c**, both Install Command and Build Command
overrides in Project Settings → Build and Deployment:

```
cd ../path0 && corepack pnpm@latest install --frozen-lockfile=false
cd ../path0 && corepack pnpm@latest --filter @zabetna/admin run build
```

**4d. pnpm 10+ hard-fails on any dependency's install script that isn't
explicitly allow-listed.** With 4a–4c fixed, `pnpm install` actually ran
for the first time (733 packages resolved and downloaded) — but then
failed with `[ERR_PNPM_IGNORED_BUILDS] Ignored build scripts:
unrs-resolver@1.12.2`, exit code 1. This is not a Vercel quirk: pnpm 10+
refuses to run any dependency's `postinstall`/`preinstall`/`install`
script unless it's on an explicit allow-list, and (confirmed by
reproducing locally, both with and without `CI` set) treats an
unapproved script as a **hard install failure**, not a warning.
`unrs-resolver` is a transitive devDependency of `eslint-config-next` (via
`eslint-import-resolver-typescript`) — used only by `next lint`, not by
`next build` — whose postinstall just downloads the correct prebuilt
native binary for the platform; it's a legitimate, narrowly-scoped
dependency, not something to blanket-disable script execution for.

**Fix:** committed in `pnpm-workspace.yaml`:

```yaml
allowBuilds:
  unrs-resolver: true
```

This is a real, permanent fix in the repo (not a Vercel setting), found
by reproducing the exact Vercel install command locally
(`git clone` into a scratch dir, run the same `corepack pnpm@latest
install --frozen-lockfile=false`), running `pnpm approve-builds --all` to
see what it changes, and confirming a clean `pnpm install` (exit 0)
followed by a full `pnpm --filter @zabetna/admin run build` (exit 0)
locally before pushing.

Two more wrinkles inside 4c–4d, found while getting the first real
GitHub-triggered build green:

- **Vercel's `/vercel/pathN` layout is not stable across builds.** The
  `cd ../path0` fix above (from one diagnostic build) failed on the very
  next build with `No such file or directory` — a *different* build had
  the Root Directory context **nested inside** the full-checkout
  directory (`/vercel/path0/apps/admin`) instead of a **sibling**
  (`/vercel/path1` next to `/vercel/path0`). Both layouts occur; which one
  you get is not predictable. The robust fix, used in the final Install
  and Build Command overrides, searches from the common ancestor instead
  of assuming a relative path:
  ```
  cd $(dirname $(find /vercel -maxdepth 2 -name pnpm-workspace.yaml)) && corepack pnpm@latest install --frozen-lockfile=false --config.pm-on-fail=ignore
  cd $(dirname $(find /vercel -maxdepth 2 -name pnpm-workspace.yaml)) && corepack pnpm@latest --config.pm-on-fail=ignore --filter @zabetna/admin run build
  ```
- **`corepack pnpm@latest` vs this repo's `packageManager` pin.**
  `apps/admin/package.json` pins `"packageManager": "pnpm@10.28.0"`. When
  `corepack pnpm@latest` (currently resolving to v11.24.0 — the only
  version proven to correctly resolve this workspace on Vercel) detects
  that pin, pnpm itself hard-errors: *"Your current pnpm is v11.24.0...
  pnpm does not switch versions when running under corepack."* Fix:
  `--config.pm-on-fail=ignore`, the exact bypass pnpm's own error message
  suggests — included in the commands above.

## Root cause 5: missing Supabase environment variables on Vercel (runtime 500, not a build failure)

Once root cause 4 was fully fixed, the first GitHub-triggered build
succeeded completely (`dpl_6fL9iUUMggMjdTMv9oKcTDkwAiX4`, `READY`,
aliased to production) — the first time in this entire incident a
GitHub-triggered build had gone green. But the live site then 500'd on
every route (`/`, `/login`). `get_runtime_logs` showed:

```
Error: Your project's URL and Key are required to create a Supabase client!
```

thrown from `apps/admin/lib/supabase/server.ts`, which reads
`process.env.NEXT_PUBLIC_SUPABASE_URL!` and
`process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!` with non-null assertions —
so a missing env var throws exactly this at request time, not at build
time.

**This bug had been latent the entire incident.** Every deployment before
`dpl_6fL9iUUMggMjdTMv9oKcTDkwAiX4` failed at *build* time (root causes
1–4), so none of them ever reached the code path that reads these env
vars. The first build to succeed immediately exposed it.

**Root cause:** `NEXT_PUBLIC_SUPABASE_URL` and
`NEXT_PUBLIC_SUPABASE_ANON_KEY` were never set as Vercel Environment
Variables for this project — Environment Variables was completely empty.
They exist locally in `apps/admin/.env.local`, but that file is (and
always has been) `.gitignore`d and was never committed (`git ls-files`
and `git log --all -- apps/admin/.env*` both return nothing). **This
directly contradicts a claim in `README.md`** that said `.env` files with
the live project's URL and anon key were "already committed for all
three apps" — that was never true for `apps/admin`; the README has been
corrected.

**Fix:** added both variables in Vercel Dashboard → Project Settings →
Environment Variables, scoped to all three environments (Production,
Preview, Development), then triggered a Redeploy (Vercel requires a new
deployment to pick up env var changes — existing deployments don't get
them retroactively). Values are the anon/publishable key and project URL
from `apps/admin/.env.local`; per the Supabase docs and this repo's own
README, the anon key is meant to be public in a client bundle, so it was
entered as a Vercel **Config** variable, not **Secret** (Vercel's own UI
flags `NEXT_PUBLIC_`-prefixed values entered as Secret with a warning,
since Secret values can't be read back but `NEXT_PUBLIC_` values are
inlined into the client bundle at build time regardless — Config is the
correct type for them). Verified via `web_fetch_vercel_url` (`/`,
`/login`, `/shops` all HTTP 200) and `get_runtime_logs` (zero errors in
the 10 minutes after redeploy).

**Follow-up worth doing:** decide whether `apps/admin/.env.local` (or at
least its two `NEXT_PUBLIC_*` values, which are meant to be public) should
actually be committed to the repo per the README's original intent — right
now the README's claim is fixed to match reality (not committed), but the
underlying inconsistency between "these are meant to be public" and
"they're gitignored and only live in Vercel's dashboard" is a legitimate
process question, not just a documentation bug.

## Tooling limitation worth knowing about

The Claude Cowork cloud sandbox that diagnosed this had no working way to
`git push` to this repo — not a config mistake, a currently-open product
limitation
([anthropics/claude-code#84581](https://github.com/anthropics/claude-code/issues/84581)):
the error message references an `add_repo` tool that doesn't exist, and
there is no repository-picker UI in Cowork as of this writing. If this
happens again: don't burn time hunting for a settings toggle that isn't
there. Either push from a machine with real GitHub credentials, or have
Claude package a `git bundle` (small, preserves full history) and hand it
off the same way this one was handled.

## Why this took 12 hours instead of minutes

Three things compounded: (a) most of the causes above produce the **same
symptom** (site down / crashing), so fixing one and still seeing a broken
site looked like "the fix didn't work" rather than "there's a second,
different bug underneath" — they had to be found and fixed in sequence,
not diagnosed all at once; (b) there was no pre-production check — every
deploy went straight to `zabetna-admin-v2.vercel.app` (production) with
nothing to catch a broken build before real traffic hit it (of the ~20
deployments to this project during the incident, more than half failed
outright); (c) root causes 1–4 were all *build-time* failures and root
cause 5 was a *runtime* failure — since a broken build never reaches
runtime, the missing-env-vars bug was completely invisible until the
build was finally fixed, so it couldn't have been found any earlier than
it was, no matter how thorough the build-time debugging was.

## Recommended follow-ups (status as of this doc)

- ~~Confirm Root Directory (`apps/admin`) once GitHub actually has content
  and a deploy runs from it.~~ **Done** — confirmed correct via the
  successful GitHub-triggered build.
- Use Vercel's normal preview-deployment flow (non-production branches /
  PRs get a preview URL automatically once Git is properly connected) so a
  broken build — or a runtime bug like root cause 5 — is caught before it
  reaches production, instead of after. **Not yet done.** This is the
  single highest-leverage follow-up: it would have caught root cause 5
  before it ever hit real users.
- Decide whether the two public Supabase env vars should be committed to
  the repo (matching the README's original intent) instead of living only
  in Vercel's dashboard, so a future new environment (a second Vercel
  project, a local clone, Render) doesn't silently hit the same missing-
  env-var 500. **Not yet done** — see root cause 5's follow-up note above.
- Consider whether staying current on Next.js 16.x (2 months old at time
  of writing, still shaking out breaking-change edges like the one in
  cause #1) is worth it for an internal admin tool vs. pinning to a more
  settled version — a deliberate call, not a default.

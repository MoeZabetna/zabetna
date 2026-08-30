# Incident: Admin Panel down for ~12 hours (2026-08-30)

**Status:** Resolved. Production (`zabetna-admin-v2.vercel.app`) is live and
verified. This doc exists so nobody — human or Claude — has to re-derive
this from scratch next time something in this pipeline breaks.

## Summary

A change to `apps/admin` (a day-of-week column + related logic on offers)
was followed by a Vercel deploy that crashed. What looked like "one bad
deploy" was actually **three independent, stacked failures**, two in the
app's dependency on Next.js 16 conventions and one in how this project was
hosted on Vercel. Fixing the first one wasn't enough — the site kept
failing in a different way after each fix, which is why this took ~12
hours instead of minutes. Read this before assuming a Vercel 404 or crash
here is a one-line fix.

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

Two things compounded: (a) each of the three causes above produces the
**same symptom** (site down / 404), so fixing one and still seeing a
broken site looked like "the fix didn't work" rather than "there's a
second, different bug underneath" — they had to be found and fixed in
sequence, not diagnosed all at once; (b) there was no pre-production check
— every deploy went straight to `zabetna-admin-v2.vercel.app` (production)
with nothing to catch a broken build before real traffic hit it. Of the
last 16 deployments to this project, 8 failed outright.

## Recommended follow-ups (not yet done as of this doc)

- Confirm Root Directory (`apps/admin`) once GitHub actually has content
  and a deploy runs from it.
- Use Vercel's normal preview-deployment flow (non-production branches /
  PRs get a preview URL automatically once Git is properly connected) so a
  broken build is caught before it reaches production, instead of after.
- Consider whether staying current on Next.js 16.x (2 months old at time
  of writing, still shaking out breaking-change edges like the one in
  cause #1) is worth it for an internal admin tool vs. pinning to a more
  settled version — a deliberate call, not a default.

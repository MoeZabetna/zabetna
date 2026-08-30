import { NextResponse } from "next/server";

// Deliberately a no-op. Full incident history (2026-08):
//
// 1. Edge Middleware bundling crashed production with `ReferenceError:
//    __dirname is not defined` — reproduced even with a completely empty
//    middleware function (no Supabase import, no logic at all) — across two
//    separate Vercel projects and two Next.js versions (16.3.3 and 15.5.24).
//    Known Next.js Edge Runtime bundling bug class (see vercel/next.js#53968,
//    #58140, supabase/supabase#21009).
//    FIX: renamed middleware.ts -> proxy.ts per the Next.js 16 convention
//    (https://nextjs.org/docs/app/guides/upgrading/version-16#middleware-to-proxy).
//    "The `middleware` filename is deprecated, and has been renamed to
//    `proxy`... The `edge` runtime is NOT supported in `proxy`. The `proxy`
//    runtime is `nodejs`, and it cannot be configured." Renaming forces the
//    Node.js runtime unconditionally, sidestepping the Edge bundling bug
//    entirely. No `export const config = { runtime: "nodejs" }` and no
//    `experimental.nodeMiddleware` flag are needed (or valid) any more.
//
// 2. AFTER that rename, clean builds (all routes listed, `ƒ Proxy
//    (Middleware)` correctly recognized) still 404'd on every dynamic route
//    in production with ZERO runtime function invocations logged — a
//    platform-level Vercel routing failure, not an app bug. Root cause per
//    Vercel's own Knowledge Base (https://vercel.com/kb/guide/why-is-my-deployed-project-giving-404):
//    this project's Framework Preset was not recognized as Next.js
//    ("framework": null in the Vercel project record), which skips
//    framework-specific routing-manifest generation, so nothing routes.
//    FIX: set the Vercel project's Framework Preset explicitly to Next.js
//    (Project Settings -> General -> Framework Preset) — or pass
//    `projectSettings.framework: "nextjs"` on API/CLI deploys — and
//    redeploy. This is a Vercel PROJECT SETTING, not something fixable from
//    this file or any application code; if production 404s sitewide again
//    with empty runtime logs, check that setting first.
//
// This file exists only because Next.js expects a proxy.ts/middleware.ts
// present for this convention; it does no auth work. Auth is enforced
// entirely by Server Components — see app/(dashboard)/layout.tsx, the real
// access-control boundary for every dashboard route, and app/login/page.tsx
// for the session-refresh trade-off this implies.
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

export function proxy() {
  return NextResponse.next();
}

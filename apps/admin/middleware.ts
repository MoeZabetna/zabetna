import { NextResponse } from "next/server";

// Deliberately a no-op. Full incident history: Next.js's Edge Middleware
// bundling crashed in production with `ReferenceError: __dirname is not
// defined` — reproduced even with a completely empty middleware function (no
// Supabase import, no logic at all) — across two separate Vercel projects
// and two Next.js versions (16.3.3 and 15.5.24). This is a known,
// long-standing class of Next.js Edge Runtime bundling bug (see
// vercel/next.js#53968, #58140, supabase/supabase#21009 — the same
// ReferenceError has recurred for years across unrelated codebases whenever
// Next's own middleware bundling pulls in a Node-only reference that Edge
// Runtime's stripped-down JS environment doesn't provide). Not fixable from
// application code, and not specific to this project or account.
//
// This file exists only because some hosts still expect a middleware.ts
// present; it does no auth work. Auth is enforced entirely by Server
// Components — see app/(dashboard)/layout.tsx, the real access-control
// boundary for every dashboard route, and app/login/page.tsx for the
// session-refresh trade-off this implies.
export function middleware() {
  return NextResponse.next();
}

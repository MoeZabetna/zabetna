import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LoginForm } from "@/components/LoginForm";

// NOTE: there is deliberately no proxy.ts (formerly middleware.ts) doing
// auth in this app — proxy.ts is a permanent no-op (see its own comment for
// the full incident history: a Next.js Edge Runtime bundling bug that
// required renaming middleware.ts -> proxy.ts, plus a separate Vercel
// Framework Preset issue that caused sitewide 404s after that).
//
// Auth is enforced entirely by Server Components — the same
// createServerClient code runs correctly here and in
// app/(dashboard)/layout.tsx, which is the real access-control boundary for
// every dashboard route. This page's job is just the UX nicety of bouncing
// an already-logged-in admin away from /login.
//
// Trade-off worth knowing: Supabase's own guidance recommends middleware/proxy
// specifically so it can refresh the session cookie on every request.
// Without that, a Server Component can read cookies but not write refreshed
// ones back to the browser (see lib/supabase/server.ts). In practice this is
// covered by @supabase/ssr's browser client (lib/supabase/client.ts), which
// refreshes the access token and syncs the cookie itself as long as a tab
// stays open — so the realistic failure mode is just "signed out after
// being away past token expiry, sent back to /login", not a silent
// mid-session logout.
export default async function LoginPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-50 px-4">
      <LoginForm />
    </div>
  );
}

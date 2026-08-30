import { redirect } from "next/navigation";
import { getCurrentAdmin } from "@/lib/auth/current-admin";
import { Sidebar } from "@/components/Sidebar";
import { SignOutButton } from "@/components/SignOutButton";
import { ChangePasswordButton } from "@/components/ChangePasswordButton";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const admin = await getCurrentAdmin();

  // proxy.ts (formerly middleware.ts) already guarantees a Supabase session
  // exists here — this catches the narrower case of a session that isn't an
  // *admin* (no admin_users row, or a suspended one), which the proxy can't
  // check without an extra DB round trip on every request.
  if (!admin) {
    redirect("/login");
  }

  return (
    <div className="flex min-h-screen bg-neutral-50">
      <Sidebar permissions={admin.permissions} />
      <div className="flex-1">
        <header className="flex items-center justify-between border-b border-neutral-200 bg-white px-6 py-3">
          <div className="text-sm text-neutral-500">
            <span className="font-medium text-neutral-900">{admin.fullName}</span> · {admin.roleName}
          </div>
          <div className="flex items-center gap-4">
            <ChangePasswordButton email={admin.email} />
            <SignOutButton />
          </div>
        </header>
        <main className="p-6">{children}</main>
      </div>
    </div>
  );
}

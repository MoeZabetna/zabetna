import { createClient } from "@/lib/supabase/server";
import { getCurrentAdmin, hasPermission } from "@/lib/auth/current-admin";
import { AdminsManager } from "./AdminsManager";

export default async function AdminsPage() {
  const admin = await getCurrentAdmin();

  if (!hasPermission(admin, "admins.manage")) {
    return (
      <div>
        <h1 className="text-xl font-semibold text-neutral-900">Admins</h1>
        <p className="mt-2 text-sm text-neutral-500">Your role doesn&apos;t have permission to manage admins.</p>
      </div>
    );
  }

  const supabase = await createClient();
  const [{ data: admins, error }, { data: roles }] = await Promise.all([
    supabase
      .from("admin_users")
      .select("id, full_name, email, status, created_at, role_id, admin_roles(name)")
      .order("created_at", { ascending: true }),
    supabase.from("admin_roles").select("id, name").order("name", { ascending: true }),
  ]);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-neutral-900">Admins</h1>
        <p className="text-sm text-neutral-500">
          Everyone with a login to this admin panel, and what role they hold. Adding someone here creates their
          real login — see the note in the &quot;Add admin&quot; form for how the temporary password works.
        </p>
      </div>

      {error && (
        <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          Couldn&apos;t load admins: {error.message}
        </p>
      )}

      <AdminsManager initialAdmins={admins ?? []} roles={roles ?? []} currentAdminId={admin!.id} />
    </div>
  );
}

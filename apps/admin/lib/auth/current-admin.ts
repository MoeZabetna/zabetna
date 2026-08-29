import { createClient } from "../supabase/server";

export interface CurrentAdmin {
  id: string;
  fullName: string;
  email: string;
  roleName: string;
  permissions: string[];
}

/**
 * Resolves the logged-in Supabase Auth user to their admin_users row plus
 * the flattened list of permission keys their role grants (joins
 * role_permissions -> admin_permissions, mirroring has_permission() in SQL).
 * Returns null if there's no session, or the session belongs to a user with
 * no admin_users row (e.g. a shop_staff or app user who somehow hit /login) —
 * both cases are treated as "not an admin" by the dashboard layout.
 */
export async function getCurrentAdmin(): Promise<CurrentAdmin | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("admin_users")
    .select(
      "id, full_name, email, status, admin_roles(name, role_permissions(admin_permissions(key)))"
    )
    .eq("auth_user_id", user.id)
    .eq("status", "active")
    .maybeSingle();

  if (error || !data || !data.admin_roles) return null;

  const role = Array.isArray(data.admin_roles) ? data.admin_roles[0] : data.admin_roles;
  if (!role) return null;

  // Supabase's nested-select type inference bottoms out at `any` for a
  // triple-nested relation like this one, so the shape is asserted
  // explicitly here rather than trusted from the query's inferred type.
  type RolePermissionRow = {
    admin_permissions: { key: string } | { key: string }[] | null;
  };
  const rolePermissions = (role.role_permissions ?? []) as RolePermissionRow[];
  const permissions = rolePermissions
    .map((rp) => (Array.isArray(rp.admin_permissions) ? rp.admin_permissions[0] : rp.admin_permissions))
    .filter((p): p is { key: string } => !!p)
    .map((p) => p.key);

  return {
    id: data.id,
    fullName: data.full_name,
    email: data.email,
    roleName: role.name,
    permissions,
  };
}

export function hasPermission(admin: CurrentAdmin | null, key: string): boolean {
  return !!admin?.permissions.includes(key);
}

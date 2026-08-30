"use server";

import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentAdmin, hasPermission } from "@/lib/auth/current-admin";

// Every action here writes to auth.users (via the service-role Admin API)
// or to admin_users/audit_log — the most security-sensitive surface in
// this app. Unlike the rest of the codebase, RLS is NOT a sufficient
// safety net by itself: the Admin API call in inviteAdmin() bypasses
// Postgres entirely, so each action explicitly re-checks
// hasPermission(admin, "admins.manage") itself rather than relying only
// on the admin_users_manage RLS policy. See docs/admin-management.md.

function generateTempPassword(): string {
  // 24 random bytes, base64url-encoded (~32 chars, no padding/slashes) —
  // comfortably clears any password-strength policy Supabase Auth could
  // reasonably have configured. Shown once to the inviting admin; never
  // logged, stored, or emailed (this app has no email-sending capability
  // to lose it to in the first place).
  return randomBytes(24).toString("base64url");
}

async function writeAuditLog(
  adminId: string,
  action: string,
  entityType: string,
  entityId: string | null,
  diff: Record<string, string | number | boolean | null>
) {
  const supabase = await createClient();
  // Best-effort — a logging failure shouldn't roll back or hide a real
  // admin-management action from the person who just performed it.
  // Cast to Json: this function is only ever called here with flat
  // string/number/boolean/null values, which satisfy Json structurally,
  // but the generated Database["audit_log"]["Insert"]["diff"] type is a
  // recursive Json union that TS won't widen a plain Record into.
  await supabase
    .from("audit_log")
    .insert({ admin_id: adminId, action, entity_type: entityType, entity_id: entityId, diff: diff as never });
}

export interface InviteAdminInput {
  fullName: string;
  email: string;
  roleId: string;
}

export async function inviteAdmin(input: InviteAdminInput) {
  const admin = await getCurrentAdmin();
  if (!hasPermission(admin, "admins.manage")) {
    return { error: "You don't have permission to add admins.", tempPassword: null };
  }

  const email = input.email.trim().toLowerCase();
  if (!email || !input.fullName.trim() || !input.roleId) {
    return { error: "Name, email, and role are all required.", tempPassword: null };
  }

  let adminClient;
  try {
    adminClient = createAdminClient();
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Admin client isn't configured.", tempPassword: null };
  }

  const tempPassword = generateTempPassword();

  const { data: created, error: createError } = await adminClient.auth.admin.createUser({
    email,
    password: tempPassword,
    email_confirm: true, // no email service exists to send a confirmation link — see docs/admin-management.md
  });

  if (createError || !created.user) {
    // Supabase surfaces "already registered" distinctly — worth a clearer
    // message than the raw error text.
    const message = createError?.message?.toLowerCase().includes("already")
      ? `${email} already has a login. If they need admin access, ask an existing Super Admin to add them from the database directly — there's no "convert an existing user to admin" flow yet.`
      : createError?.message ?? "Couldn't create the account.";
    return { error: message, tempPassword: null };
  }

  const supabase = await createClient();
  const { data: adminUser, error: insertError } = await supabase
    .from("admin_users")
    .insert({
      auth_user_id: created.user.id,
      full_name: input.fullName.trim(),
      email,
      role_id: input.roleId,
      status: "active",
      invited_by: admin!.id,
    })
    .select("id, full_name, email, status, created_at, admin_roles(name)")
    .single();

  if (insertError) {
    // The auth account now exists but has no admin_users row — not a
    // silent success. Surface this plainly rather than pretending it
    // worked; the auth user can be cleaned up or linked manually.
    return {
      error: `Account was created in Supabase Auth, but adding it to admin_users failed: ${insertError.message}. It has no admin access yet — this needs a manual fix, not a retry (retrying will hit "already registered").`,
      tempPassword: null,
    };
  }

  await writeAuditLog(admin!.id, "admin.invite", "admin_users", adminUser.id, {
    email,
    full_name: input.fullName.trim(),
    role_id: input.roleId,
  });

  revalidatePath("/admins");
  return { error: null, tempPassword, adminUser };
}

export async function updateAdminRole(id: string, roleId: string) {
  const admin = await getCurrentAdmin();
  if (!hasPermission(admin, "admins.manage")) return { error: "You don't have permission to manage admins." };
  if (id === admin!.id) return { error: "You can't change your own role — ask another Super Admin." };

  const supabase = await createClient();
  const { error } = await supabase.from("admin_users").update({ role_id: roleId }).eq("id", id);
  // guard_last_admin_manage_holder_trigger (0018_admin_management.sql)
  // is what actually stops the dangerous case (demoting the last
  // admins.manage holder); this is defense at the app layer, not the
  // only line of defense.
  if (!error) await writeAuditLog(admin!.id, "admin.role_change", "admin_users", id, { role_id: roleId });

  revalidatePath("/admins");
  return { error: error?.message ?? null };
}

export async function setAdminStatus(id: string, status: "active" | "suspended") {
  const admin = await getCurrentAdmin();
  if (!hasPermission(admin, "admins.manage")) return { error: "You don't have permission to manage admins." };
  if (id === admin!.id) return { error: "You can't suspend your own account — ask another Super Admin." };

  const supabase = await createClient();
  const { error } = await supabase.from("admin_users").update({ status }).eq("id", id);
  if (!error) await writeAuditLog(admin!.id, "admin.status_change", "admin_users", id, { status });

  revalidatePath("/admins");
  return { error: error?.message ?? null };
}

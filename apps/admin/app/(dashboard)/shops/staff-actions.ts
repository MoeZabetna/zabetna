"use server";

import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentAdmin, hasPermission } from "@/lib/auth/current-admin";

// Shop staff are the Restaurant App's users — this is what gives a shop's
// staff a real login to scan/verify redemptions there. Same shape as
// apps/admin/app/(dashboard)/admins/actions.ts (service-role Admin API to
// create a real auth.users login, since RLS can't gate an API call that
// never touches a table through the normal client), gated on shops.manage
// rather than admins.manage — shop_staff_admin_write already requires
// shops.manage for the shop_staff row itself, so this just adds the same
// explicit re-check inviteAdmin() uses, for the same reason.
//
// Unlike admins.manage, there's no "last holder" lockout risk here: an
// admin with shops.manage can always add more staff later, so suspending
// every staff member at a shop is inconvenient, not dangerous — no guard
// trigger needed to match guard_last_admin_manage_holder().

function generateTempPassword(): string {
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
  await supabase
    .from("audit_log")
    .insert({ admin_id: adminId, action, entity_type: entityType, entity_id: entityId, diff: diff as never });
}

export interface InviteShopStaffInput {
  shopId: string;
  fullName: string;
  email: string;
  role: "owner" | "manager" | "staff";
}

export async function inviteShopStaff(input: InviteShopStaffInput) {
  const admin = await getCurrentAdmin();
  if (!hasPermission(admin, "shops.manage")) {
    return { error: "You don't have permission to manage shop staff.", tempPassword: null };
  }

  const email = input.email.trim().toLowerCase();
  if (!email || !input.fullName.trim() || !input.shopId) {
    return { error: "Name, email, and shop are all required.", tempPassword: null };
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
    email_confirm: true, // no email service exists to send a confirmation link — same gap as admin invites
  });

  if (createError || !created.user) {
    const message = createError?.message?.toLowerCase().includes("already")
      ? `${email} already has a login. There's no "convert an existing user to shop staff" flow yet.`
      : (createError?.message ?? "Couldn't create the account.");
    return { error: message, tempPassword: null };
  }

  const supabase = await createClient();
  const { data: staff, error: insertError } = await supabase
    .from("shop_staff")
    .insert({
      shop_id: input.shopId,
      auth_user_id: created.user.id,
      full_name: input.fullName.trim(),
      email,
      role: input.role,
      status: "active",
    })
    .select("id, shop_id, full_name, email, role, status, created_at")
    .single();

  if (insertError) {
    // Same honesty as inviteAdmin(): the auth account exists even though
    // the shop_staff row didn't get created — don't pretend this worked.
    return {
      error: `Account was created in Supabase Auth, but adding it as shop staff failed: ${insertError.message}. It has no shop access yet — this needs a manual fix, not a retry (retrying will hit "already registered").`,
      tempPassword: null,
    };
  }

  await writeAuditLog(admin!.id, "shop_staff.invite", "shop_staff", staff.id, {
    shop_id: input.shopId,
    email,
    full_name: input.fullName.trim(),
    role: input.role,
  });

  revalidatePath("/shops");
  return { error: null, tempPassword, staff };
}

export async function updateShopStaffRole(id: string, role: "owner" | "manager" | "staff") {
  const admin = await getCurrentAdmin();
  if (!hasPermission(admin, "shops.manage")) return { error: "You don't have permission to manage shop staff." };

  const supabase = await createClient();
  const { error } = await supabase.from("shop_staff").update({ role }).eq("id", id);
  if (!error) await writeAuditLog(admin!.id, "shop_staff.role_change", "shop_staff", id, { role });

  revalidatePath("/shops");
  return { error: error?.message ?? null };
}

export async function setShopStaffStatus(id: string, status: "active" | "suspended") {
  const admin = await getCurrentAdmin();
  if (!hasPermission(admin, "shops.manage")) return { error: "You don't have permission to manage shop staff." };

  const supabase = await createClient();
  const { error } = await supabase.from("shop_staff").update({ status }).eq("id", id);
  if (!error) await writeAuditLog(admin!.id, "shop_staff.status_change", "shop_staff", id, { status });

  revalidatePath("/shops");
  return { error: error?.message ?? null };
}

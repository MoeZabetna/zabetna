import type { SupabaseClient } from "@supabase/supabase-js";

export interface ActiveStaff {
  id: string;
  shopId: string;
  shopName: string;
  fullName: string;
  role: "owner" | "manager" | "staff";
}

/**
 * After a successful auth sign-in, this app is only useful to someone with
 * an *active* shop_staff row — that's the same gate verify-redemption
 * enforces server-side (see supabase/functions/verify-redemption), checked
 * here too so a suspended or never-onboarded login gets a clear reason
 * immediately at sign-in instead of a confusing failure the first time they
 * try to scan a code.
 *
 * shop_staff_self_read RLS lets a signed-in user read only their own row
 * (auth_user_id = auth.uid()), so this can't be used to probe other shops.
 */
export async function loadActiveStaff(
  client: SupabaseClient
): Promise<{ staff: ActiveStaff } | { staff: null; reason: string }> {
  const { data: userData, error: userError } = await client.auth.getUser();
  if (userError || !userData.user) {
    return { staff: null, reason: "Not signed in." };
  }

  const { data, error } = await client
    .from("shop_staff")
    .select("id, shop_id, full_name, role, status, shops(name)")
    .eq("auth_user_id", userData.user.id)
    .maybeSingle();

  if (error) {
    return { staff: null, reason: `Couldn't check your account: ${error.message}` };
  }
  if (!data) {
    return {
      staff: null,
      reason: "This login isn't set up as shop staff yet. Ask your Zabetna admin to add you from the Shops page.",
    };
  }
  if (data.status !== "active") {
    return { staff: null, reason: "Your shop staff account has been suspended. Contact your Zabetna admin." };
  }

  const shop = Array.isArray(data.shops) ? data.shops[0] : data.shops;

  return {
    staff: {
      id: data.id,
      shopId: data.shop_id,
      shopName: shop?.name ?? "Your shop",
      fullName: data.full_name,
      role: data.role,
    },
  };
}

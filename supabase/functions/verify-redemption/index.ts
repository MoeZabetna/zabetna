// supabase/functions/verify-redemption
//
// Called by the Restaurant App after scanning a User App's QR code.
// This is the one place a redemption is allowed to flip to "verified" —
// see docs/blueprint.html §04, steps 4–5, for the fraud-control reasoning
// behind each check below. Order matters: cheapest/most-common rejection
// reasons are checked first.

import { createClient } from "jsr:@supabase/supabase-js@2";

Deno.serve(async (req) => {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ status: "rejected", reason: "Missing Authorization header" }, 401);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { global: { headers: { Authorization: authHeader } } }
  );

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    return json({ status: "rejected", reason: "Not authenticated" }, 401);
  }

  const { data: staff, error: staffError } = await supabase
    .from("shop_staff")
    .select("id, shop_id, status")
    .eq("auth_user_id", userData.user.id)
    .single();
  if (staffError || !staff || staff.status !== "active") {
    return json({ status: "rejected", reason: "Not an active shop staff account" }, 403);
  }

  const { token } = await req.json();
  if (!token) return json({ status: "rejected", reason: "token is required" }, 400);

  const { data: redemption, error: redemptionError } = await supabase
    .from("redemptions")
    .select("id, offer_id, shop_id, status, expires_at, offers(title)")
    .eq("token", token)
    .single();

  if (redemptionError || !redemption) {
    return json({ status: "rejected", reason: "Unrecognized code" }, 404);
  }

  // A code generated for another shop is never valid here, regardless of
  // whether the scanning staff account is itself legitimate.
  if (redemption.shop_id !== staff.shop_id) {
    return json({ status: "rejected", reason: "This code was not issued for your shop" }, 403);
  }

  if (redemption.status === "verified") {
    return json({ status: "rejected", reason: "This code has already been used" }, 409);
  }
  if (redemption.status !== "pending") {
    return json({ status: "rejected", reason: `Code is ${redemption.status}` }, 409);
  }
  if (new Date(redemption.expires_at) < new Date()) {
    // Best-effort mark as expired; the response is authoritative either way.
    await supabase.from("redemptions").update({ status: "expired" }).eq("id", redemption.id);
    return json({ status: "rejected", reason: "This code has expired" }, 409);
  }

  // Conditional update — only succeeds if status is still 'pending' at write
  // time, closing the race window between two near-simultaneous scans.
  const { data: updated, error: updateError } = await supabase
    .from("redemptions")
    .update({ status: "verified", verified_by: staff.id, verified_at: new Date().toISOString() })
    .eq("id", redemption.id)
    .eq("status", "pending")
    .select("id")
    .single();

  if (updateError || !updated) {
    return json({ status: "rejected", reason: "This code was just used by another scan" }, 409);
  }

  const offerTitle = Array.isArray(redemption.offers)
    ? redemption.offers[0]?.title
    : (redemption.offers as { title: string } | null)?.title;

  return json({ status: "verified", offerTitle: offerTitle ?? "Offer" });
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

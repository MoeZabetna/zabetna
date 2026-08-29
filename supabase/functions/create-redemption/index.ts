// supabase/functions/create-redemption
//
// Called by the User App when a user taps "Redeem" on an offer.
// Never write to `redemptions` directly from a client — this is the one
// place that validates an offer is actually redeemable before a token
// is issued. See docs/blueprint.html §04, step 1–2.

import { createClient } from "jsr:@supabase/supabase-js@2";

Deno.serve(async (req) => {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return json({ error: "Missing Authorization header" }, 401);
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { global: { headers: { Authorization: authHeader } } }
  );

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    return json({ error: "Not authenticated" }, 401);
  }
  const userId = userData.user.id;

  const { offerId } = await req.json();
  if (!offerId) return json({ error: "offerId is required" }, 400);

  const { data: offer, error: offerError } = await supabase
    .from("offers")
    .select("id, shop_id, status, start_at, end_at, per_user_limit, total_limit")
    .eq("id", offerId)
    .single();

  if (offerError || !offer) return json({ error: "Offer not found" }, 404);

  const now = new Date();
  if (offer.status !== "active") return json({ error: "Offer is not active" }, 409);
  if (now < new Date(offer.start_at) || now > new Date(offer.end_at)) {
    return json({ error: "Offer is outside its active window" }, 409);
  }

  // Per-user limit: count this user's already-verified redemptions of this offer.
  const { count: userCount } = await supabase
    .from("redemptions")
    .select("id", { count: "exact", head: true })
    .eq("offer_id", offerId)
    .eq("user_id", userId)
    .eq("status", "verified");
  if ((userCount ?? 0) >= offer.per_user_limit) {
    return json({ error: "You've already used this offer the maximum number of times" }, 409);
  }

  // Total limit: count all verified redemptions of this offer, if capped.
  if (offer.total_limit !== null) {
    const { count: totalCount } = await supabase
      .from("redemptions")
      .select("id", { count: "exact", head: true })
      .eq("offer_id", offerId)
      .eq("status", "verified");
    if ((totalCount ?? 0) >= offer.total_limit) {
      return json({ error: "This offer has reached its total redemption limit" }, 409);
    }
  }

  const { data: redemption, error: insertError } = await supabase
    .from("redemptions")
    .insert({ offer_id: offerId, shop_id: offer.shop_id, user_id: userId })
    .select("id, token, expires_at")
    .single();

  if (insertError || !redemption) {
    return json({ error: "Could not create redemption" }, 500);
  }

  return json({
    redemptionId: redemption.id,
    offerId,
    shopId: offer.shop_id,
    token: redemption.token,
    expiresAt: redemption.expires_at,
  });
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

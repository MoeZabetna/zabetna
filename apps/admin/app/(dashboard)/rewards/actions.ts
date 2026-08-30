"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentAdmin } from "@/lib/auth/current-admin";

// Gated by RLS policy `reward_requests_admin_update` (rewards.manage) — see
// supabase/migrations/0016_rewards_program.sql. The row's own
// guard_reward_request_transition() trigger is what actually enforces
// correctness here (a request can only leave 'pending' once, and its
// points/usd/phone/user_id are re-locked on the way out) — these actions
// just supply the two columns the trigger *does* allow through:
// status and processed_by (the admin who actioned it). admin_note is
// optional context for the rejection reason.
//
// Money has already moved by the time "Confirm" is pressed here — the
// admin wires the Wish Money transfer manually, outside this app, first.
// This action only records that it happened; it does not send anything.

export async function confirmRewardRequest(id: string) {
  const admin = await getCurrentAdmin();
  if (!admin) return { error: "Not signed in." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("reward_redemption_requests")
    .update({ status: "confirmed", processed_by: admin.id })
    .eq("id", id);

  revalidatePath("/rewards");
  return { error: error?.message ?? null };
}

export async function rejectRewardRequest(id: string, note: string) {
  const admin = await getCurrentAdmin();
  if (!admin) return { error: "Not signed in." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("reward_redemption_requests")
    .update({ status: "rejected", processed_by: admin.id, admin_note: note || null })
    .eq("id", id);

  revalidatePath("/rewards");
  return { error: error?.message ?? null };
}

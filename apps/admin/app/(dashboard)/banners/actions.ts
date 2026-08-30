"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

// Gated by RLS policy `banners_admin_write` (content.manage) — see
// docs/blueprint.html §05, same permission that gates categories writes.

export interface BannerInput {
  imageUrl: string;
  placement: "homepage" | "category";
  categoryId: string | null;
  linkType: "shop" | "offer" | "category" | "external_url";
  linkTarget: string;
  startAt: string;
  endAt: string;
  status: "draft" | "scheduled" | "active" | "expired";
}

export async function createBanner(input: BannerInput) {
  const supabase = await createClient();
  // Next sort_order within this banner's own scope (homepage, or this one
  // category) — a new banner in a different category shouldn't jump the
  // queue of an unrelated placement group.
  let countQuery = supabase.from("banners").select("id", { count: "exact", head: true }).eq("placement", input.placement);
  countQuery = input.categoryId ? countQuery.eq("category_id", input.categoryId) : countQuery.is("category_id", null);
  const { count } = await countQuery;
  const { error } = await supabase.from("banners").insert({
    image_url: input.imageUrl,
    placement: input.placement,
    category_id: input.categoryId,
    link_type: input.linkType,
    link_target: input.linkTarget || null,
    start_at: input.startAt,
    end_at: input.endAt || null,
    status: input.status,
    sort_order: count ?? 0,
  });
  revalidatePath("/banners");
  return { error: error?.message ?? null };
}

export async function updateBanner(id: string, input: BannerInput) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("banners")
    .update({
      image_url: input.imageUrl,
      placement: input.placement,
      category_id: input.categoryId,
      link_type: input.linkType,
      link_target: input.linkTarget || null,
      start_at: input.startAt,
      end_at: input.endAt || null,
      status: input.status,
    })
    .eq("id", id);
  revalidatePath("/banners");
  return { error: error?.message ?? null };
}

export async function deleteBanner(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("banners").delete().eq("id", id);
  revalidatePath("/banners");
  return { error: error?.message ?? null };
}

/**
 * Swaps this banner's sort_order with its neighbor in `direction`, scoped to
 * `orderedIds` — the current on-screen order for one placement group
 * (homepage, or one specific category) — mirroring moveCategory in
 * app/(dashboard)/categories/actions.ts. sort_order is what determines
 * slider order when a placement group has more than one active banner.
 */
export async function moveBanner(orderedIds: string[], id: string, direction: "up" | "down") {
  const index = orderedIds.indexOf(id);
  const swapWith = direction === "up" ? index - 1 : index + 1;
  if (index === -1 || swapWith < 0 || swapWith >= orderedIds.length) {
    return { error: null };
  }

  const supabase = await createClient();
  const { data: rows, error: readError } = await supabase
    .from("banners")
    .select("id, sort_order")
    .in("id", [orderedIds[index], orderedIds[swapWith]]);
  if (readError || !rows || rows.length !== 2) {
    return { error: readError?.message ?? "Could not read banner order" };
  }

  const [a, b] = rows;
  const first = await supabase.from("banners").update({ sort_order: b.sort_order }).eq("id", a.id);
  const second = await supabase.from("banners").update({ sort_order: a.sort_order }).eq("id", b.id);
  revalidatePath("/banners");
  return { error: first.error?.message ?? second.error?.message ?? null };
}

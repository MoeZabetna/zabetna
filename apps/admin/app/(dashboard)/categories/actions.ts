"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

// Every mutation here runs through the logged-in admin's own Supabase
// session — RLS policy `categories_admin_write` (content.manage) is what
// actually blocks a Content Manager without that permission, not this file.
// A rejected write comes back as a Postgres RLS error, surfaced to the
// caller as `error`.

export async function createCategory(input: {
  name: string;
  icon: string;
  iconUrl: string | null;
  parentId: string | null;
}) {
  const supabase = await createClient();
  const { count } = await supabase.from("categories").select("id", { count: "exact", head: true });
  const { error } = await supabase.from("categories").insert({
    name: input.name,
    icon: input.icon,
    icon_url: input.iconUrl,
    parent_id: input.parentId,
    sort_order: count ?? 0,
  });
  revalidatePath("/categories");
  return { error: error?.message ?? null };
}

export async function updateCategory(
  id: string,
  input: { name: string; icon: string; iconUrl: string | null; isActive: boolean }
) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("categories")
    .update({ name: input.name, icon: input.icon, icon_url: input.iconUrl, is_active: input.isActive })
    .eq("id", id);
  revalidatePath("/categories");
  return { error: error?.message ?? null };
}

export async function deleteCategory(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("categories").delete().eq("id", id);
  revalidatePath("/categories");
  return { error: error?.message ?? null };
}

/**
 * Swaps this category's sort_order with its neighbor in `direction`, so
 * reordering never needs to renumber the whole list. `orderedIds` is the
 * current on-screen order (already sorted by sort_order), passed from the
 * client so this doesn't need its own read-then-write round trip.
 */
export async function moveCategory(orderedIds: string[], id: string, direction: "up" | "down") {
  const index = orderedIds.indexOf(id);
  const swapWith = direction === "up" ? index - 1 : index + 1;
  if (index === -1 || swapWith < 0 || swapWith >= orderedIds.length) {
    return { error: null };
  }

  const supabase = await createClient();
  const { data: rows, error: readError } = await supabase
    .from("categories")
    .select("id, sort_order")
    .in("id", [orderedIds[index], orderedIds[swapWith]]);
  if (readError || !rows || rows.length !== 2) {
    return { error: readError?.message ?? "Could not read category order" };
  }

  // Two plain updates, not upsert: upsert's ON CONFLICT DO UPDATE path still
  // evaluates the VALUES row's NOT NULL constraints before the conflict is
  // resolved, so a {id, sort_order}-only upsert would fail on the `name`
  // column even though this is really just two ordinary updates.
  const [a, b] = rows;
  const first = await supabase.from("categories").update({ sort_order: b.sort_order }).eq("id", a.id);
  const second = await supabase.from("categories").update({ sort_order: a.sort_order }).eq("id", b.id);
  revalidatePath("/categories");
  return { error: first.error?.message ?? second.error?.message ?? null };
}

"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export interface ShopInput {
  name: string;
  categoryId: string;
  description: string;
  address: string;
  phone: string;
  lat: number | null;
  lng: number | null;
  status: "pending" | "active" | "suspended";
  bannerImageUrl: string | null;
  menuImages: string[];
}

// Gated by RLS policy `shops_admin_write` (shops.manage) — see
// docs/blueprint.html §05. A Content Manager or Reports Viewer session
// hitting these gets a Postgres permission error back, not a 500.

export async function createShop(input: ShopInput) {
  const supabase = await createClient();
  const { error } = await supabase.from("shops").insert({
    name: input.name,
    category_id: input.categoryId,
    description: input.description || null,
    address: input.address || null,
    phone: input.phone || null,
    lat: input.lat,
    lng: input.lng,
    status: input.status,
    banner_image_url: input.bannerImageUrl,
    menu_images: input.menuImages,
  });
  revalidatePath("/shops");
  return { error: error?.message ?? null };
}

export async function updateShop(id: string, input: ShopInput) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("shops")
    .update({
      name: input.name,
      category_id: input.categoryId,
      description: input.description || null,
      address: input.address || null,
      phone: input.phone || null,
      lat: input.lat,
      lng: input.lng,
      status: input.status,
      banner_image_url: input.bannerImageUrl,
      menu_images: input.menuImages,
    })
    .eq("id", id);
  revalidatePath("/shops");
  return { error: error?.message ?? null };
}

export async function deleteShop(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("shops").delete().eq("id", id);
  revalidatePath("/shops");
  return { error: error?.message ?? null };
}

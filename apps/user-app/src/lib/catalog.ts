import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Reads of the public catalogue: categories, shops, offers, banners.
 *
 * Every table here is protected by a "public read of live rows only" RLS
 * policy (`categories_public_read`, `shops_public_read`, and siblings in
 * 0001_init.sql), so none of these queries filter on status for security —
 * the database already refuses to return a pending shop or a draft offer.
 * The explicit `.eq("status", ...)` calls below are for *ordering and
 * intent*, not access control, and removing one would not leak anything.
 */

export type Category = {
  id: string;
  name: string;
  /** Icon name as stored by the admin panel; may not be an Ionicon. */
  icon: string | null;
  sortOrder: number;
};

export type Shop = {
  id: string;
  name: string;
  categoryId: string;
  description: string | null;
  logoUrl: string | null;
  coverImages: string[];
  address: string | null;
  city: string | null;
  lat: number | null;
  lng: number | null;
  phone: string | null;
};

export type Offer = {
  id: string;
  shopId: string;
  title: string;
  description: string | null;
  terms: string | null;
  discountType: "percentage" | "fixed" | "bogo";
  discountValue: number;
  minimumOrderValue: number;
  imageUrl: string | null;
  endAt: string;
};

export async function fetchCategories(client: SupabaseClient): Promise<Category[]> {
  const { data, error } = await client
    .from("categories")
    .select("id, name, icon, sort_order")
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []).map((row: any) => ({
    id: row.id,
    name: row.name,
    icon: row.icon,
    sortOrder: row.sort_order,
  }));
}

export async function fetchShops(
  client: SupabaseClient,
  options: { categoryId?: string; search?: string; limit?: number } = {}
): Promise<Shop[]> {
  let query = client
    .from("shops")
    .select("id, name, category_id, description, logo_url, cover_images, address, city, lat, lng, phone")
    .order("name", { ascending: true })
    .limit(options.limit ?? 50);

  if (options.categoryId) query = query.eq("category_id", options.categoryId);
  if (options.search?.trim()) query = query.ilike("name", `%${options.search.trim()}%`);

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  return (data ?? []).map(mapShop);
}

export async function fetchShop(client: SupabaseClient, shopId: string): Promise<Shop | null> {
  const { data, error } = await client
    .from("shops")
    .select("id, name, category_id, description, logo_url, cover_images, address, city, lat, lng, phone")
    .eq("id", shopId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data ? mapShop(data) : null;
}

/**
 * Offers for a shop that are live *right now*.
 *
 * `end_at`/`start_at` are filtered here rather than relying on
 * `status = 'active'` alone, because an offer's window can close without
 * anything flipping its status — 0008 added day-of-week scheduling and
 * fixed exactly that class of "shown but not actually redeemable" bug.
 * Day-of-week itself is enforced by `create-redemption`, which is the only
 * place that decision may live; this list stays deliberately slightly
 * generous rather than duplicating that rule and drifting from it.
 */
export async function fetchOffersForShop(client: SupabaseClient, shopId: string): Promise<Offer[]> {
  const nowIso = new Date().toISOString();
  const { data, error } = await client
    .from("offers")
    .select(
      "id, shop_id, title, description, terms, discount_type, discount_value, minimum_order_value, image_url, end_at"
    )
    .eq("shop_id", shopId)
    .eq("status", "active")
    .lte("start_at", nowIso)
    .gt("end_at", nowIso)
    .order("end_at", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []).map(mapOffer);
}

export type ShopWithOfferCount = Shop & { offerCount: number };

/**
 * Shops for the Home Screen's "Featured" rows, grouped by category.
 *
 * One query per category would be N round trips on a screen that renders
 * three of them; this fetches the shops for all requested categories at
 * once and groups client-side.
 */
export async function fetchShopsByCategories(
  client: SupabaseClient,
  categoryIds: string[],
  perCategory = 6
): Promise<Map<string, Shop[]>> {
  const grouped = new Map<string, Shop[]>();
  if (categoryIds.length === 0) return grouped;

  const { data, error } = await client
    .from("shops")
    .select("id, name, category_id, description, logo_url, cover_images, address, city, lat, lng, phone")
    .in("category_id", categoryIds)
    .order("name", { ascending: true });

  if (error) throw new Error(error.message);

  for (const row of data ?? []) {
    const shop = mapShop(row);
    const list = grouped.get(shop.categoryId) ?? [];
    if (list.length < perCategory) {
      list.push(shop);
      grouped.set(shop.categoryId, list);
    }
  }
  return grouped;
}

function mapShop(row: any): Shop {
  return {
    id: row.id,
    name: row.name,
    categoryId: row.category_id,
    description: row.description,
    logoUrl: row.logo_url,
    coverImages: row.cover_images ?? [],
    address: row.address,
    city: row.city,
    lat: row.lat,
    lng: row.lng,
    phone: row.phone,
  };
}

function mapOffer(row: any): Offer {
  return {
    id: row.id,
    shopId: row.shop_id,
    title: row.title,
    description: row.description,
    terms: row.terms,
    discountType: row.discount_type,
    discountValue: Number(row.discount_value),
    minimumOrderValue: Number(row.minimum_order_value ?? 0),
    imageUrl: row.image_url,
    endAt: row.end_at,
  };
}

/** "30% off", "$5 off", "Buy one get one" — the label shown on offer cards. */
export function formatDiscount(offer: Offer): string {
  switch (offer.discountType) {
    case "percentage":
      return `${offer.discountValue}% off`;
    case "fixed":
      return `$${offer.discountValue.toFixed(2)} off`;
    case "bogo":
      return "Buy one get one";
  }
}

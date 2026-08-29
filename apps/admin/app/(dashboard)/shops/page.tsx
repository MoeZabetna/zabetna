import { createClient } from "@/lib/supabase/server";
import { getCurrentAdmin, hasPermission } from "@/lib/auth/current-admin";
import { ShopsManager } from "./ShopsManager";

export default async function ShopsPage() {
  const admin = await getCurrentAdmin();
  const supabase = await createClient();

  const [{ data: shops }, { data: categories }, { data: offerCounts }] = await Promise.all([
    supabase
      .from("shops")
      .select("id, name, category_id, description, address, phone, lat, lng, status, categories(name)")
      .order("created_at", { ascending: false }),
    supabase.from("categories").select("id, name").order("sort_order", { ascending: true }),
    supabase.from("offers").select("shop_id, status, start_at, end_at"),
  ]);

  // Per-shop offer visibility for the two columns ShopsManager shows next to
  // each row: how many offers are genuinely live right now, and how many
  // are inactive (paused, or expired — either by status or because end_at
  // has passed while status was left at "active", since nothing flips that
  // automatically) so admins can see at a glance which shops have offers
  // that stopped working. Drafts are excluded from both counts — they're
  // not published yet, not a problem to flag.
  const now = Date.now();
  const offerStatsByShop = (offerCounts ?? []).reduce<Record<string, { active: number; inactive: number }>>(
    (acc, o) => {
      const stats = (acc[o.shop_id] ??= { active: 0, inactive: 0 });
      const withinWindow = new Date(o.start_at).getTime() <= now && now <= new Date(o.end_at).getTime();
      if (o.status === "active" && withinWindow) stats.active += 1;
      else if (o.status === "expired" || o.status === "paused" || (o.status === "active" && !withinWindow)) {
        stats.inactive += 1;
      }
      return acc;
    },
    {}
  );

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-neutral-900">Shops</h1>
        <p className="text-sm text-neutral-500">Onboard shops, assign a category, and pin their location.</p>
      </div>
      <ShopsManager
        initialShops={shops ?? []}
        categories={categories ?? []}
        canManage={hasPermission(admin, "shops.manage")}
        offerStatsByShop={offerStatsByShop}
      />
    </div>
  );
}

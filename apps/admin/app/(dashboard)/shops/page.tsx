import { createClient } from "@/lib/supabase/server";
import { getCurrentAdmin, hasPermission } from "@/lib/auth/current-admin";
import { ShopsManager } from "./ShopsManager";

export default async function ShopsPage() {
  const admin = await getCurrentAdmin();
  const supabase = await createClient();

  const [{ data: shops }, { data: categories }] = await Promise.all([
    supabase
      .from("shops")
      .select("id, name, category_id, description, address, phone, lat, lng, status, categories(name)")
      .order("created_at", { ascending: false }),
    supabase.from("categories").select("id, name").order("sort_order", { ascending: true }),
  ]);

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
      />
    </div>
  );
}

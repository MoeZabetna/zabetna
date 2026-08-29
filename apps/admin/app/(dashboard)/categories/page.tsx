import { createClient } from "@/lib/supabase/server";
import { getCurrentAdmin, hasPermission } from "@/lib/auth/current-admin";
import { CategoriesManager } from "./CategoriesManager";

export default async function CategoriesPage() {
  const admin = await getCurrentAdmin();
  const supabase = await createClient();
  const { data: categories } = await supabase
    .from("categories")
    .select("id, name, icon, icon_url, is_active, sort_order, parent_id")
    .order("sort_order", { ascending: true });

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-neutral-900">Categories</h1>
        <p className="text-sm text-neutral-500">
          Controls category order and icon in the User App&apos;s home screen and browse grid.
        </p>
      </div>
      <CategoriesManager
        initialCategories={categories ?? []}
        canManage={hasPermission(admin, "content.manage")}
      />
    </div>
  );
}

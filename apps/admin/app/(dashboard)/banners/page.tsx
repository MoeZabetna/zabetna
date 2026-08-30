import { createClient } from "@/lib/supabase/server";
import { getCurrentAdmin, hasPermission } from "@/lib/auth/current-admin";
import { BannersManager } from "./BannersManager";

export default async function BannersPage() {
  const admin = await getCurrentAdmin();
  const supabase = await createClient();

  const [{ data: banners }, { data: categories }] = await Promise.all([
    supabase.from("banners").select("*").order("sort_order", { ascending: true }),
    supabase.from("categories").select("id, name").order("sort_order", { ascending: true }),
  ]);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-neutral-900">Banners</h1>
        <p className="text-sm text-neutral-500">
          Header images for the homepage and each category page. Upload one banner for a static header, or several
          for a rotating slider.
        </p>
      </div>
      <BannersManager
        initialBanners={banners ?? []}
        categories={categories ?? []}
        canManage={hasPermission(admin, "content.manage")}
      />
    </div>
  );
}

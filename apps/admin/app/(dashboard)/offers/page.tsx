import { createClient } from "@/lib/supabase/server";
import { getCurrentAdmin, hasPermission } from "@/lib/auth/current-admin";
import { OffersManager } from "./OffersManager";

export default async function OffersPage({
  searchParams,
}: {
  searchParams: Promise<{ shop?: string }>;
}) {
  const { shop: shopFilter } = await searchParams;
  const admin = await getCurrentAdmin();
  const supabase = await createClient();

  const [{ data: offers }, { data: shops }] = await Promise.all([
    supabase
      .from("offers")
      .select(
        "id, shop_id, title, discount_type, discount_value, minimum_order_value, per_user_limit, total_limit, start_at, end_at, status, days_of_week, shops(name)"
      )
      .order("created_at", { ascending: false }),
    supabase.from("shops").select("id, name").order("name", { ascending: true }),
  ]);

  const filteredShop = shopFilter ? (shops ?? []).find((s) => s.id === shopFilter) : null;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-neutral-900">Offers</h1>
        <p className="text-sm text-neutral-500">
          Discounts and Buy 1 Get 1 Free deals shops offer to app users.
          {filteredShop && (
            <>
              {" "}
              Showing offers for <span className="font-medium text-neutral-700">{filteredShop.name}</span> only —{" "}
              <a href="/offers" className="text-neutral-900 underline">
                view all
              </a>
              .
            </>
          )}
        </p>
      </div>
      <OffersManager
        initialOffers={offers ?? []}
        shops={shops ?? []}
        canManage={hasPermission(admin, "shops.manage")}
        shopFilter={shopFilter ?? null}
      />
    </div>
  );
}

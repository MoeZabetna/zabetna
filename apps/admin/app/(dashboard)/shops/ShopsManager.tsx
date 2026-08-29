"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { Pencil, Trash2, Plus, MapPin, Tag, AlertTriangle, CheckCircle2 } from "lucide-react";
import { createShop, updateShop, deleteShop, type ShopInput } from "./actions";

// Leaflet touches `window` at import time — must be client-only, and
// next/dynamic's ssr:false only works when called from a "use client" file,
// which this is.
const MapPicker = dynamic(() => import("@/components/MapPicker").then((m) => m.MapPicker), {
  ssr: false,
  loading: () => <div className="flex h-[260px] items-center justify-center rounded-md border border-neutral-200 text-sm text-neutral-400">Loading map…</div>,
});

interface CategoryRef {
  name: string | null;
}

export interface ShopRow {
  id: string;
  name: string;
  category_id: string;
  description: string | null;
  address: string | null;
  phone: string | null;
  lat: number | null;
  lng: number | null;
  status: "pending" | "active" | "suspended";
  categories: CategoryRef | CategoryRef[] | null;
}

function categoryName(shop: ShopRow): string {
  const c = Array.isArray(shop.categories) ? shop.categories[0] : shop.categories;
  return c?.name ?? "—";
}

const STATUS_STYLE: Record<ShopRow["status"], string> = {
  active: "bg-emerald-100 text-emerald-700",
  pending: "bg-amber-100 text-amber-700",
  suspended: "bg-neutral-200 text-neutral-600",
};

export function ShopsManager({
  initialShops,
  categories,
  canManage,
  offerStatsByShop,
}: {
  initialShops: ShopRow[];
  categories: { id: string; name: string }[];
  canManage: boolean;
  offerStatsByShop: Record<string, { active: number; inactive: number }>;
}) {
  const [shops, setShops] = useState(initialShops);
  const [editing, setEditing] = useState<ShopRow | "new" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function remove(id: string) {
    if (!confirm("Delete this shop? This also removes its offers and redemption history.")) return;
    const res = await deleteShop(id);
    if (res.error) setError(res.error);
    else setShops((prev) => prev.filter((s) => s.id !== id));
  }

  return (
    <div>
      {error && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
      )}

      <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-neutral-50 text-xs uppercase tracking-wide text-neutral-500">
            <tr>
              <th className="px-4 py-2 font-medium">Shop</th>
              <th className="px-4 py-2 font-medium">Category</th>
              <th className="px-4 py-2 font-medium">Location</th>
              <th className="px-4 py-2 font-medium">Status</th>
              <th className="px-4 py-2 font-medium">Active offers</th>
              <th className="px-4 py-2 font-medium">Needs attention</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {shops.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-neutral-500">
                  No shops yet — onboard the first one below.
                </td>
              </tr>
            )}
            {shops.map((shop) => {
              const stats = offerStatsByShop[shop.id] ?? { active: 0, inactive: 0 };
              return (
              <tr key={shop.id} className="border-t border-neutral-100">
                <td className="px-4 py-3">
                  <div className="font-medium text-neutral-900">{shop.name}</div>
                  <div className="text-xs text-neutral-500">{shop.address ?? "No address set"}</div>
                </td>
                <td className="px-4 py-3 text-neutral-600">{categoryName(shop)}</td>
                <td className="px-4 py-3 text-neutral-600">
                  {shop.lat && shop.lng ? (
                    <a
                      className="flex items-center gap-1 text-neutral-600 hover:text-neutral-900"
                      href={`https://www.google.com/maps?q=${shop.lat},${shop.lng}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <MapPin size={13} /> View on map
                    </a>
                  ) : (
                    <span className="text-neutral-400">Not pinned</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${STATUS_STYLE[shop.status]}`}>
                    {shop.status}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <Link
                    href={`/offers?shop=${shop.id}`}
                    className="flex items-center gap-1 text-neutral-600 hover:text-neutral-900"
                  >
                    <Tag size={13} />
                    {stats.active > 0 ? `${stats.active} active` : "None"}
                  </Link>
                </td>
                <td className="px-4 py-3">
                  {stats.inactive > 0 ? (
                    <Link
                      href={`/offers?shop=${shop.id}`}
                      className="flex items-center gap-1 text-amber-700 hover:text-amber-900"
                      title="Includes offers that are paused, or expired either by status or because their end date has passed"
                    >
                      <AlertTriangle size={13} />
                      {stats.inactive} inactive
                    </Link>
                  ) : stats.active > 0 ? (
                    <span className="flex items-center gap-1 text-emerald-600">
                      <CheckCircle2 size={13} /> All active
                    </span>
                  ) : (
                    <span className="text-neutral-400">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  {canManage && (
                    <div className="flex justify-end gap-2">
                      <button onClick={() => setEditing(shop)} className="text-neutral-400 hover:text-neutral-900">
                        <Pencil size={16} />
                      </button>
                      <button onClick={() => remove(shop.id)} className="text-neutral-400 hover:text-red-600">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  )}
                </td>
              </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {canManage && (
        <button
          onClick={() => setEditing("new")}
          className="mt-4 flex items-center gap-2 rounded-md border border-neutral-300 px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100"
        >
          <Plus size={16} /> Onboard shop
        </button>
      )}

      {editing && (
        <ShopFormModal
          shop={editing === "new" ? null : editing}
          categories={categories}
          onClose={() => setEditing(null)}
          onSaved={(saved) => {
            setShops((prev) => (editing === "new" ? [saved, ...prev] : prev.map((s) => (s.id === saved.id ? saved : s))));
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

const BEIRUT_CENTER: [number, number] = [33.8938, 35.5018];

function ShopFormModal({
  shop,
  categories,
  onClose,
  onSaved,
}: {
  shop: ShopRow | null;
  categories: { id: string; name: string }[];
  onClose: () => void;
  onSaved: (shop: ShopRow) => void;
}) {
  const [name, setName] = useState(shop?.name ?? "");
  const [categoryId, setCategoryId] = useState(shop?.category_id ?? categories[0]?.id ?? "");
  const [description, setDescription] = useState(shop?.description ?? "");
  const [address, setAddress] = useState(shop?.address ?? "");
  const [phone, setPhone] = useState(shop?.phone ?? "");
  const [status, setStatus] = useState<ShopRow["status"]>(shop?.status ?? "pending");
  const [lat, setLat] = useState(shop?.lat ?? BEIRUT_CENTER[0]);
  const [lng, setLng] = useState(shop?.lng ?? BEIRUT_CENTER[1]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    if (!name.trim() || !categoryId) {
      setError("Name and category are required.");
      return;
    }
    setSaving(true);
    setError(null);

    const input: ShopInput = { name, categoryId, description, address, phone, lat, lng, status };
    const res = shop ? await updateShop(shop.id, input) : await createShop(input);
    setSaving(false);
    if (res.error) return setError(res.error);

    const categoryName = categories.find((c) => c.id === categoryId)?.name ?? null;
    onSaved({
      id: shop?.id ?? crypto.randomUUID(),
      name,
      category_id: categoryId,
      description: description || null,
      address: address || null,
      phone: phone || null,
      lat,
      lng,
      status,
      categories: { name: categoryName },
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg bg-white p-5 shadow-xl">
        <h2 className="mb-4 text-sm font-semibold text-neutral-900">{shop ? "Edit shop" : "Onboard shop"}</h2>

        <div className="mb-4 grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-neutral-600">Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-900"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-neutral-600">Category</label>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-900"
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <label className="mb-1 block text-xs font-medium text-neutral-600">Description</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          className="mb-4 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-900"
        />

        <div className="mb-4 grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-neutral-600">Address</label>
            <input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-900"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-neutral-600">Phone</label>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-900"
            />
          </div>
        </div>

        <label className="mb-1 block text-xs font-medium text-neutral-600">Location</label>
        <div className="mb-4">
          <MapPicker lat={lat} lng={lng} onChange={(newLat, newLng) => { setLat(newLat); setLng(newLng); }} />
        </div>

        <label className="mb-1 block text-xs font-medium text-neutral-600">Status</label>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as ShopRow["status"])}
          className="mb-4 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-900"
        >
          <option value="pending">Pending</option>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
        </select>

        {error && <p className="mb-3 text-sm text-red-600">{error}</p>}

        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="rounded-md px-3 py-2 text-sm text-neutral-600 hover:bg-neutral-100">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="rounded-md bg-neutral-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

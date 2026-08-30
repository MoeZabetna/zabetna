"use client";

import { useState } from "react";
import { Pencil, Trash2, Plus, Tag, Search } from "lucide-react";
import { createOffer, updateOffer, deleteOffer, type OfferInput } from "./actions";
import { Pagination } from "@/components/Pagination";

const PAGE_SIZE = 20;

interface ShopRef {
  name: string | null;
}

export interface OfferRow {
  id: string;
  shop_id: string;
  title: string;
  discount_type: "percentage" | "fixed" | "bogo";
  discount_value: number;
  minimum_order_value: number;
  per_user_limit: number;
  total_limit: number | null;
  start_at: string;
  end_at: string;
  status: "draft" | "active" | "paused" | "expired";
  days_of_week: number[];
  shops: ShopRef | ShopRef[] | null;
}

// 0=Sunday..6=Saturday, matching the offers.days_of_week column (chosen to
// match JS Date.getDay()).
const DAYS = [
  { value: 0, label: "Sun" },
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
] as const;

function daysLabel(days: number[]): string {
  if (days.length === 0) return "Every day";
  const sorted = [...days].sort((a, b) => a - b);
  const weekdays = [1, 2, 3, 4, 5];
  const weekend = [0, 6];
  if (sorted.length === 5 && weekdays.every((d) => sorted.includes(d))) return "Weekdays";
  if (sorted.length === 2 && weekend.every((d) => sorted.includes(d))) return "Weekends";
  return sorted.map((d) => DAYS[d].label).join(", ");
}

function shopName(offer: OfferRow): string {
  const s = Array.isArray(offer.shops) ? offer.shops[0] : offer.shops;
  return s?.name ?? "—";
}

function discountLabel(offer: Pick<OfferRow, "discount_type" | "discount_value">): string {
  switch (offer.discount_type) {
    case "percentage":
      return `${offer.discount_value}% off`;
    case "fixed":
      return `$${offer.discount_value} off`;
    case "bogo":
      return "Buy 1 Get 1 Free";
  }
}

const STATUS_STYLE: Record<OfferRow["status"], string> = {
  active: "bg-emerald-100 text-emerald-700",
  draft: "bg-neutral-200 text-neutral-600",
  paused: "bg-amber-100 text-amber-700",
  expired: "bg-red-100 text-red-700",
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export function OffersManager({
  initialOffers,
  shops,
  canManage,
  shopFilter,
}: {
  initialOffers: OfferRow[];
  shops: { id: string; name: string }[];
  canManage: boolean;
  shopFilter: string | null;
}) {
  const [offers, setOffers] = useState(initialOffers);
  const [editing, setEditing] = useState<OfferRow | "new" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [shopSearch, setShopSearch] = useState("");
  const [page, setPage] = useState(1);

  const shopScoped = shopFilter ? offers.filter((o) => o.shop_id === shopFilter) : offers;
  const query = shopSearch.trim().toLowerCase();
  const visibleOffers = query ? shopScoped.filter((o) => shopName(o).toLowerCase().includes(query)) : shopScoped;

  const pageCount = Math.max(1, Math.ceil(visibleOffers.length / PAGE_SIZE));

  // Any change to what's being filtered can shrink the result set out from
  // under whatever page the admin was on — jump back to page 1 rather than
  // leave them looking at a page that no longer has matching rows. This is
  // React's documented pattern for "adjust state when a prop/derived value
  // changes" (react.dev/learn/you-might-not-need-an-effect) — setState
  // during render, not inside an effect, so it doesn't cause an extra
  // render pass.
  const [prevFilterKey, setPrevFilterKey] = useState(`${shopSearch} ${shopFilter}`);
  const filterKey = `${shopSearch} ${shopFilter}`;
  if (filterKey !== prevFilterKey) {
    setPrevFilterKey(filterKey);
    setPage(1);
  }

  const currentPage = Math.min(page, pageCount);
  const pagedOffers = visibleOffers.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  async function remove(id: string) {
    if (!confirm("Delete this offer? This also removes its redemption history.")) return;
    const res = await deleteOffer(id);
    if (res.error) setError(res.error);
    else setOffers((prev) => prev.filter((o) => o.id !== id));
  }

  return (
    <div>
      {error && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
      )}

      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="relative w-full max-w-xs">
          <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
          <input
            value={shopSearch}
            onChange={(e) => setShopSearch(e.target.value)}
            placeholder="Search by shop name…"
            className="w-full rounded-md border border-neutral-300 py-2 pl-8 pr-3 text-sm outline-none focus:border-neutral-900"
          />
        </div>
        {canManage && (
          <button
            onClick={() => setEditing("new")}
            className="flex shrink-0 items-center gap-2 rounded-md border border-neutral-300 px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100"
          >
            <Plus size={16} /> Add offer
          </button>
        )}
      </div>

      <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-neutral-50 text-xs uppercase tracking-wide text-neutral-500">
            <tr>
              <th className="px-4 py-2 font-medium">Offer</th>
              <th className="px-4 py-2 font-medium">Shop</th>
              <th className="px-4 py-2 font-medium">Discount</th>
              <th className="px-4 py-2 font-medium">Days</th>
              <th className="px-4 py-2 font-medium">Window</th>
              <th className="px-4 py-2 font-medium">Limits</th>
              <th className="px-4 py-2 font-medium">Status</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {visibleOffers.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-6 text-center text-neutral-500">
                  {query
                    ? `No offers match "${shopSearch.trim()}".`
                    : shopFilter
                      ? "No offers for this shop yet."
                      : "No offers yet — add the first one above."}
                </td>
              </tr>
            )}
            {pagedOffers.map((offer) => (
              <tr key={offer.id} className="border-t border-neutral-100">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2 font-medium text-neutral-900">
                    <Tag size={14} className="text-neutral-400" />
                    {offer.title}
                  </div>
                </td>
                <td className="px-4 py-3 text-neutral-600">{shopName(offer)}</td>
                <td className="px-4 py-3 text-neutral-600">
                  {discountLabel(offer)}
                  {offer.minimum_order_value > 0 && (
                    <div className="text-xs text-neutral-400">Min. order ${offer.minimum_order_value}</div>
                  )}
                </td>
                <td className="px-4 py-3 text-neutral-600">{daysLabel(offer.days_of_week)}</td>
                <td className="px-4 py-3 text-neutral-600">
                  {formatDate(offer.start_at)} – {formatDate(offer.end_at)}
                </td>
                <td className="px-4 py-3 text-neutral-600">
                  {offer.per_user_limit}/user{offer.total_limit ? ` · ${offer.total_limit} total` : ""}
                </td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${STATUS_STYLE[offer.status]}`}>
                    {offer.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  {canManage && (
                    <div className="flex justify-end gap-2">
                      <button onClick={() => setEditing(offer)} className="text-neutral-400 hover:text-neutral-900">
                        <Pencil size={16} />
                      </button>
                      <button onClick={() => remove(offer.id)} className="text-neutral-400 hover:text-red-600">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {visibleOffers.length > 0 && (
        <div className="mt-2 text-center text-xs text-neutral-400">
          {visibleOffers.length} offer{visibleOffers.length === 1 ? "" : "s"}
          {query || shopFilter ? " matching" : " total"}
        </div>
      )}
      <Pagination page={currentPage} pageCount={pageCount} onPageChange={setPage} />

      {editing && (
        <OfferFormModal
          offer={editing === "new" ? null : editing}
          shops={shops}
          defaultShopId={shopFilter}
          onClose={() => setEditing(null)}
          onSaved={(saved) => {
            setOffers((prev) => (editing === "new" ? [saved, ...prev] : prev.map((o) => (o.id === saved.id ? saved : o))));
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

// datetime-local inputs want "YYYY-MM-DDTHH:mm" in the *browser's* local
// time; new Date(iso) + these getters read it back out in that same local
// time, so what an admin types is what they see next time they edit — no
// UTC/local mismatch, at the cost of two admins in different timezones
// reading a slightly different clock time for the same instant (acceptable
// for a single-market MVP; revisit if the admin team ever spans timezones).
function toLocalInputValue(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromLocalInputValue(value: string): string {
  return new Date(value).toISOString();
}

function defaultWindow() {
  const start = new Date();
  const end = new Date();
  end.setDate(end.getDate() + 30);
  return { start: toLocalInputValue(start.toISOString()), end: toLocalInputValue(end.toISOString()) };
}

function OfferFormModal({
  offer,
  shops,
  defaultShopId,
  onClose,
  onSaved,
}: {
  offer: OfferRow | null;
  shops: { id: string; name: string }[];
  defaultShopId: string | null;
  onClose: () => void;
  onSaved: (offer: OfferRow) => void;
}) {
  const initialWindow = defaultWindow();
  const [shopId, setShopId] = useState(offer?.shop_id ?? defaultShopId ?? shops[0]?.id ?? "");
  const [title, setTitle] = useState(offer?.title ?? "");
  const [description, setDescription] = useState("");
  const [terms, setTerms] = useState("");
  const [discountType, setDiscountType] = useState<OfferRow["discount_type"]>(offer?.discount_type ?? "percentage");
  const [discountValue, setDiscountValue] = useState(offer?.discount_value ?? 10);
  const [minimumOrderValue, setMinimumOrderValue] = useState(offer?.minimum_order_value ?? 0);
  const [perUserLimit, setPerUserLimit] = useState(offer?.per_user_limit ?? 1);
  const [totalLimit, setTotalLimit] = useState<string>(offer?.total_limit != null ? String(offer.total_limit) : "");
  const [startAt, setStartAt] = useState(offer ? toLocalInputValue(offer.start_at) : initialWindow.start);
  const [endAt, setEndAt] = useState(offer ? toLocalInputValue(offer.end_at) : initialWindow.end);
  const [status, setStatus] = useState<OfferRow["status"]>(offer?.status ?? "draft");
  const [daysOfWeek, setDaysOfWeek] = useState<number[]>(offer?.days_of_week ?? []);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleDay(d: number) {
    setDaysOfWeek((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort((a, b) => a - b)));
  }

  async function handleSave() {
    if (!title.trim() || !shopId) {
      setError("Title and shop are required.");
      return;
    }
    if (new Date(endAt) <= new Date(startAt)) {
      setError("End date must be after the start date.");
      return;
    }
    setSaving(true);
    setError(null);

    const input: OfferInput = {
      shopId,
      title,
      description,
      terms,
      discountType,
      discountValue: discountType === "bogo" ? 0 : discountValue,
      minimumOrderValue,
      perUserLimit,
      totalLimit: totalLimit.trim() === "" ? null : Number(totalLimit),
      startAt: fromLocalInputValue(startAt),
      endAt: fromLocalInputValue(endAt),
      status,
      daysOfWeek,
    };
    const res = offer ? await updateOffer(offer.id, input) : await createOffer(input);
    setSaving(false);
    if (res.error) return setError(res.error);

    const shopLabel = shops.find((s) => s.id === shopId)?.name ?? null;
    onSaved({
      id: offer?.id ?? crypto.randomUUID(),
      shop_id: shopId,
      title,
      discount_type: input.discountType,
      discount_value: input.discountValue,
      minimum_order_value: minimumOrderValue,
      per_user_limit: perUserLimit,
      total_limit: input.totalLimit,
      start_at: input.startAt,
      end_at: input.endAt,
      status,
      days_of_week: daysOfWeek,
      shops: { name: shopLabel },
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg bg-white p-5 shadow-xl">
        <h2 className="mb-4 text-sm font-semibold text-neutral-900">{offer ? "Edit offer" : "New offer"}</h2>

        <div className="mb-4 grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-neutral-600">Title</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. 20% Off Dinner"
              className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-900"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-neutral-600">Shop</label>
            <select
              value={shopId}
              onChange={(e) => setShopId(e.target.value)}
              className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-900"
            >
              {shops.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mb-4 grid grid-cols-3 gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-neutral-600">Discount type</label>
            <select
              value={discountType}
              onChange={(e) => setDiscountType(e.target.value as OfferRow["discount_type"])}
              className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-900"
            >
              <option value="percentage">Percentage off</option>
              <option value="fixed">Fixed amount off</option>
              <option value="bogo">Buy 1 Get 1 Free</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-neutral-600">
              {discountType === "percentage" ? "Percent off" : discountType === "fixed" ? "Amount off ($)" : "Value"}
            </label>
            <input
              type="number"
              min={0}
              value={discountType === "bogo" ? "" : discountValue}
              disabled={discountType === "bogo"}
              onChange={(e) => setDiscountValue(Number(e.target.value))}
              placeholder={discountType === "bogo" ? "Not applicable" : undefined}
              className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-900 disabled:bg-neutral-100 disabled:text-neutral-400"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-neutral-600">Min. order (USD)</label>
            <input
              type="number"
              min={0}
              step="0.01"
              value={minimumOrderValue}
              onChange={(e) => setMinimumOrderValue(Number(e.target.value))}
              className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-900"
            />
            <p className="mt-1 text-xs text-neutral-400">0 = no minimum. Shown to users; not enforced automatically.</p>
          </div>
        </div>

        <label className="mb-1 block text-xs font-medium text-neutral-600">Description</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          className="mb-4 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-900"
        />

        <label className="mb-1 block text-xs font-medium text-neutral-600">Terms</label>
        <textarea
          value={terms}
          onChange={(e) => setTerms(e.target.value)}
          rows={2}
          placeholder="e.g. Dine-in only. Not valid with other promotions."
          className="mb-4 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-900"
        />

        <label className="mb-1 block text-xs font-medium text-neutral-600">Days active</label>
        <p className="mb-2 text-xs text-neutral-400">
          A shop can run several offers at once that only differ by day — e.g. one offer for weekday lunch, another
          for weekend lunch, a third for weekend brunch.
        </p>
        <div className="mb-4 flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => setDaysOfWeek([])}
            className={`rounded-md px-2.5 py-1.5 text-xs font-medium ${
              daysOfWeek.length === 0
                ? "bg-neutral-900 text-white"
                : "border border-neutral-300 text-neutral-600 hover:bg-neutral-100"
            }`}
          >
            Every day
          </button>
          {DAYS.map((d) => (
            <button
              type="button"
              key={d.value}
              onClick={() => toggleDay(d.value)}
              className={`rounded-md px-2.5 py-1.5 text-xs font-medium ${
                daysOfWeek.includes(d.value)
                  ? "bg-neutral-900 text-white"
                  : "border border-neutral-300 text-neutral-600 hover:bg-neutral-100"
              }`}
            >
              {d.label}
            </button>
          ))}
        </div>

        <div className="mb-4 grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-neutral-600">Starts</label>
            <input
              type="datetime-local"
              value={startAt}
              onChange={(e) => setStartAt(e.target.value)}
              className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-900"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-neutral-600">Ends</label>
            <input
              type="datetime-local"
              value={endAt}
              onChange={(e) => setEndAt(e.target.value)}
              className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-900"
            />
          </div>
        </div>

        <div className="mb-4 grid grid-cols-3 gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-neutral-600">Per-user limit</label>
            <input
              type="number"
              min={1}
              value={perUserLimit}
              onChange={(e) => setPerUserLimit(Number(e.target.value))}
              className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-900"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-neutral-600">Total limit</label>
            <input
              type="number"
              min={0}
              value={totalLimit}
              onChange={(e) => setTotalLimit(e.target.value)}
              placeholder="Unlimited"
              className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-900"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-neutral-600">Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as OfferRow["status"])}
              className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-900"
            >
              <option value="draft">Draft</option>
              <option value="active">Active</option>
              <option value="paused">Paused</option>
              <option value="expired">Expired</option>
            </select>
          </div>
        </div>

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

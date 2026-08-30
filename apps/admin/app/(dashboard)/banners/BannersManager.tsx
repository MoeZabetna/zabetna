"use client";

import { useState, useTransition } from "react";
import { Pencil, Trash2, Plus, ChevronUp, ChevronDown, Images } from "lucide-react";
import { createBanner, updateBanner, deleteBanner, moveBanner, type BannerInput } from "./actions";
import { BannerImagePicker } from "@/components/BannerImagePicker";
import type { Tables } from "@zabetna/shared-types";

type Banner = Tables<"banners">;
type CategoryRef = { id: string; name: string };

const STATUS_STYLE: Record<Banner["status"], string> = {
  active: "bg-emerald-100 text-emerald-700",
  scheduled: "bg-blue-100 text-blue-700",
  draft: "bg-neutral-200 text-neutral-600",
  expired: "bg-red-100 text-red-700",
};

interface Scope {
  placement: "homepage" | "category";
  categoryId: string | null;
  label: string;
}

export function BannersManager({
  initialBanners,
  categories,
  canManage,
}: {
  initialBanners: Banner[];
  categories: CategoryRef[];
  canManage: boolean;
}) {
  const [banners, setBanners] = useState(initialBanners);
  const [editing, setEditing] = useState<{ banner: Banner | null; scope: Scope } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const scopes: Scope[] = [
    { placement: "homepage", categoryId: null, label: "Homepage" },
    ...categories.map((c) => ({ placement: "category" as const, categoryId: c.id, label: c.name })),
  ];

  function bannersFor(scope: Scope): Banner[] {
    return banners
      .filter((b) => b.placement === scope.placement && b.category_id === scope.categoryId)
      .sort((a, b) => a.sort_order - b.sort_order);
  }

  function move(scope: Scope, id: string, direction: "up" | "down") {
    setError(null);
    const orderedIds = bannersFor(scope).map((b) => b.id);
    setBanners((prev) => {
      const group = bannersFor(scope);
      const idx = group.findIndex((b) => b.id === id);
      const swapIdx = direction === "up" ? idx - 1 : idx + 1;
      if (idx === -1 || swapIdx < 0 || swapIdx >= group.length) return prev;
      const a = group[idx];
      const b = group[swapIdx];
      return prev.map((row) => {
        if (row.id === a.id) return { ...row, sort_order: b.sort_order };
        if (row.id === b.id) return { ...row, sort_order: a.sort_order };
        return row;
      });
    });
    startTransition(async () => {
      const res = await moveBanner(orderedIds, id, direction);
      if (res.error) setError(res.error);
    });
  }

  function remove(id: string) {
    if (!confirm("Delete this banner?")) return;
    startTransition(async () => {
      const res = await deleteBanner(id);
      if (res.error) setError(res.error);
      else setBanners((prev) => prev.filter((b) => b.id !== id));
    });
  }

  return (
    <div>
      {error && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
      )}

      <div className="space-y-6">
        {scopes.map((scope) => {
          const group = bannersFor(scope);
          return (
            <div key={`${scope.placement}:${scope.categoryId ?? "home"}`} className="rounded-lg border border-neutral-200 bg-white">
              <div className="flex items-center justify-between border-b border-neutral-100 px-4 py-3">
                <div>
                  <div className="text-sm font-medium text-neutral-900">{scope.label}</div>
                  <div className="text-xs text-neutral-500">
                    {group.length === 0
                      ? "No banner set — this header will render empty."
                      : group.length === 1
                        ? "Static banner"
                        : `Rotating slider — ${group.length} banners`}
                  </div>
                </div>
                {canManage && (
                  <button
                    onClick={() => setEditing({ banner: null, scope })}
                    className="flex items-center gap-1.5 rounded-md border border-neutral-300 px-2.5 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-100"
                  >
                    <Plus size={14} /> Add banner
                  </button>
                )}
              </div>

              {group.length === 0 ? (
                <div className="flex items-center gap-2 px-4 py-5 text-sm text-neutral-400">
                  <Images size={16} /> Nothing uploaded yet.
                </div>
              ) : (
                <div className="divide-y divide-neutral-100">
                  {group.map((banner, i) => (
                    <div key={banner.id} className="flex items-center gap-3 px-4 py-3">
                      <div className="flex flex-col">
                        <button
                          disabled={i === 0 || isPending || !canManage}
                          onClick={() => move(scope, banner.id, "up")}
                          className="text-neutral-400 hover:text-neutral-900 disabled:opacity-20"
                        >
                          <ChevronUp size={15} />
                        </button>
                        <button
                          disabled={i === group.length - 1 || isPending || !canManage}
                          onClick={() => move(scope, banner.id, "down")}
                          className="text-neutral-400 hover:text-neutral-900 disabled:opacity-20"
                        >
                          <ChevronDown size={15} />
                        </button>
                      </div>
                      {/* eslint-disable-next-line @next/next/no-img-element -- external Supabase Storage URL, not a local/optimizable asset */}
                      <img src={banner.image_url} alt="" className="h-12 w-20 flex-shrink-0 rounded-md border border-neutral-200 object-cover" />
                      <div className="flex-1">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${STATUS_STYLE[banner.status]}`}>
                          {banner.status}
                        </span>
                        {banner.link_target && (
                          <div className="mt-1 text-xs text-neutral-500">
                            Links to {banner.link_type}: {banner.link_target}
                          </div>
                        )}
                      </div>
                      {canManage && (
                        <div className="flex gap-2">
                          <button onClick={() => setEditing({ banner, scope })} className="text-neutral-400 hover:text-neutral-900">
                            <Pencil size={16} />
                          </button>
                          <button onClick={() => remove(banner.id)} className="text-neutral-400 hover:text-red-600">
                            <Trash2 size={16} />
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {editing && (
        <BannerFormModal
          banner={editing.banner}
          scope={editing.scope}
          categories={categories}
          onClose={() => setEditing(null)}
          onSaved={(saved) => {
            setBanners((prev) =>
              editing.banner ? prev.map((b) => (b.id === saved.id ? saved : b)) : [...prev, saved]
            );
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

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

function BannerFormModal({
  banner,
  scope,
  categories,
  onClose,
  onSaved,
}: {
  banner: Banner | null;
  scope: Scope;
  categories: CategoryRef[];
  onClose: () => void;
  onSaved: (banner: Banner) => void;
}) {
  const initialWindow = defaultWindow();
  const [placement, setPlacement] = useState<"homepage" | "category">(banner?.placement === "category" ? "category" : scope.placement);
  const [categoryId, setCategoryId] = useState<string>(
    banner?.category_id ?? (scope.categoryId ?? categories[0]?.id ?? "")
  );
  const [imageUrl, setImageUrl] = useState<string | null>(banner?.image_url ?? null);
  const [linkType, setLinkType] = useState<Banner["link_type"]>(banner?.link_type ?? "external_url");
  const [linkTarget, setLinkTarget] = useState(banner?.link_target ?? "");
  const [status, setStatus] = useState<Banner["status"]>(banner?.status ?? "draft");
  const [startAt, setStartAt] = useState(banner ? toLocalInputValue(banner.start_at) : initialWindow.start);
  const [endAt, setEndAt] = useState(banner?.end_at ? toLocalInputValue(banner.end_at) : "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    if (!imageUrl) {
      setError("A banner image is required.");
      return;
    }
    if (placement === "category" && !categoryId) {
      setError("Choose a category for this banner.");
      return;
    }
    setSaving(true);
    setError(null);

    const input: BannerInput = {
      imageUrl,
      placement,
      categoryId: placement === "category" ? categoryId : null,
      linkType,
      linkTarget,
      startAt: fromLocalInputValue(startAt),
      endAt: endAt ? fromLocalInputValue(endAt) : "",
      status,
    };
    const res = banner ? await updateBanner(banner.id, input) : await createBanner(input);
    setSaving(false);
    if (res.error) return setError(res.error);

    onSaved({
      id: banner?.id ?? crypto.randomUUID(),
      image_url: imageUrl,
      placement,
      category_id: input.categoryId,
      link_type: linkType,
      link_target: linkTarget || null,
      start_at: input.startAt,
      end_at: input.endAt || null,
      status,
      sort_order: banner?.sort_order ?? 0,
      created_at: banner?.created_at ?? new Date().toISOString(),
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg bg-white p-5 shadow-xl">
        <h2 className="mb-4 text-sm font-semibold text-neutral-900">{banner ? "Edit banner" : "New banner"}</h2>

        <label className="mb-1 block text-xs font-medium text-neutral-600">Banner image</label>
        <div className="mb-4">
          <BannerImagePicker bucket="banners" value={imageUrl} onChange={setImageUrl} />
        </div>

        <div className="mb-4 grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-neutral-600">Shows on</label>
            <select
              value={placement}
              onChange={(e) => setPlacement(e.target.value as "homepage" | "category")}
              className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-900"
            >
              <option value="homepage">Homepage</option>
              <option value="category">A category page</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-neutral-600">Category</label>
            <select
              value={categoryId}
              disabled={placement !== "category"}
              onChange={(e) => setCategoryId(e.target.value)}
              className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-900 disabled:bg-neutral-100 disabled:text-neutral-400"
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mb-4 grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-neutral-600">Tapping it opens</label>
            <select
              value={linkType}
              onChange={(e) => setLinkType(e.target.value as Banner["link_type"])}
              className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-900"
            >
              <option value="shop">A shop</option>
              <option value="offer">An offer</option>
              <option value="category">A category</option>
              <option value="external_url">A web link</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-neutral-600">
              {linkType === "external_url" ? "URL" : `${linkType.charAt(0).toUpperCase()}${linkType.slice(1)} ID`}
            </label>
            <input
              value={linkTarget}
              onChange={(e) => setLinkTarget(e.target.value)}
              placeholder={linkType === "external_url" ? "https://…" : "Optional"}
              className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-900"
            />
          </div>
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
              placeholder="No end date"
              className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-900"
            />
          </div>
        </div>

        <label className="mb-1 block text-xs font-medium text-neutral-600">Status</label>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as Banner["status"])}
          className="mb-4 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-900"
        >
          <option value="draft">Draft</option>
          <option value="scheduled">Scheduled</option>
          <option value="active">Active</option>
          <option value="expired">Expired</option>
        </select>
        <p className="-mt-3 mb-4 text-xs text-neutral-400">Only &ldquo;Active&rdquo; banners are visible in the app.</p>

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

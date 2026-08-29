"use client";

import { useState, useTransition } from "react";
import { ChevronUp, ChevronDown, Pencil, Trash2, Plus, Eye, EyeOff } from "lucide-react";
import { IconPicker } from "@/components/IconPicker";
import { getCategoryIcon } from "@/lib/icons";
import { createCategory, updateCategory, deleteCategory, moveCategory } from "./actions";
import type { Tables } from "@zabetna/shared-types";

type Category = Pick<Tables<"categories">, "id" | "name" | "icon" | "is_active" | "sort_order" | "parent_id">;

// Nesting (categories.parent_id) exists in the schema for future subcategory
// support, but this first pass of the picker only manages the top-level
// list — every category created here has parent_id: null.
export function CategoriesManager({
  initialCategories,
  canManage,
}: {
  initialCategories: Category[];
  canManage: boolean;
}) {
  const [categories, setCategories] = useState(initialCategories);
  const [editing, setEditing] = useState<Category | "new" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const orderedIds = categories.map((c) => c.id);

  function move(id: string, direction: "up" | "down") {
    setError(null);
    // Optimistic local reorder so the click feels instant; the server
    // action is the source of truth and revalidatePath reconciles it.
    setCategories((prev) => {
      const idx = prev.findIndex((c) => c.id === id);
      const swap = direction === "up" ? idx - 1 : idx + 1;
      if (idx === -1 || swap < 0 || swap >= prev.length) return prev;
      const next = [...prev];
      [next[idx], next[swap]] = [next[swap], next[idx]];
      return next;
    });
    startTransition(async () => {
      const res = await moveCategory(orderedIds, id, direction);
      if (res.error) setError(res.error);
    });
  }

  function remove(id: string) {
    if (!confirm("Delete this category? Shops assigned to it will need to be reassigned.")) return;
    startTransition(async () => {
      const res = await deleteCategory(id);
      if (res.error) setError(res.error);
      else setCategories((prev) => prev.filter((c) => c.id !== id));
    });
  }

  return (
    <div>
      {error && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white">
        {categories.length === 0 && (
          <p className="p-6 text-sm text-neutral-500">No categories yet — add the first one below.</p>
        )}
        {categories.map((cat, i) => {
          const Icon = getCategoryIcon(cat.icon);
          return (
            <div
              key={cat.id}
              className="flex items-center gap-3 border-b border-neutral-100 px-4 py-3 last:border-b-0"
            >
              <div className="flex flex-col">
                <button
                  disabled={i === 0 || isPending || !canManage}
                  onClick={() => move(cat.id, "up")}
                  className="text-neutral-400 hover:text-neutral-900 disabled:opacity-20"
                >
                  <ChevronUp size={16} />
                </button>
                <button
                  disabled={i === categories.length - 1 || isPending || !canManage}
                  onClick={() => move(cat.id, "down")}
                  className="text-neutral-400 hover:text-neutral-900 disabled:opacity-20"
                >
                  <ChevronDown size={16} />
                </button>
              </div>
              <div className="flex h-9 w-9 items-center justify-center rounded-md bg-neutral-100 text-neutral-700">
                <Icon size={18} />
              </div>
              <div className="flex-1">
                <div className="text-sm font-medium text-neutral-900">{cat.name}</div>
              </div>
              {cat.is_active ? (
                <span className="flex items-center gap-1 text-xs text-emerald-600">
                  <Eye size={13} /> Active
                </span>
              ) : (
                <span className="flex items-center gap-1 text-xs text-neutral-400">
                  <EyeOff size={13} /> Hidden
                </span>
              )}
              {canManage && (
                <>
                  <button onClick={() => setEditing(cat)} className="text-neutral-400 hover:text-neutral-900">
                    <Pencil size={16} />
                  </button>
                  <button onClick={() => remove(cat.id)} className="text-neutral-400 hover:text-red-600">
                    <Trash2 size={16} />
                  </button>
                </>
              )}
            </div>
          );
        })}
      </div>

      {canManage && (
        <button
          onClick={() => setEditing("new")}
          className="mt-4 flex items-center gap-2 rounded-md border border-neutral-300 px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100"
        >
          <Plus size={16} /> Add category
        </button>
      )}

      {editing && (
        <CategoryFormModal
          category={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={(saved) => {
            setCategories((prev) => {
              if (editing === "new") return [...prev, saved];
              return prev.map((c) => (c.id === saved.id ? saved : c));
            });
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

function CategoryFormModal({
  category,
  onClose,
  onSaved,
}: {
  category: Category | null;
  onClose: () => void;
  onSaved: (category: Category) => void;
}) {
  const [name, setName] = useState(category?.name ?? "");
  const [icon, setIcon] = useState(category?.icon ?? "Store");
  const [isActive, setIsActive] = useState(category?.is_active ?? true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    if (!name.trim()) {
      setError("Name is required.");
      return;
    }
    setSaving(true);
    setError(null);

    if (category) {
      const res = await updateCategory(category.id, { name, icon, isActive });
      setSaving(false);
      if (res.error) return setError(res.error);
      onSaved({ ...category, name, icon, is_active: isActive });
    } else {
      const res = await createCategory({ name, icon, parentId: null });
      setSaving(false);
      if (res.error) return setError(res.error);
      // The server action doesn't return the new row's id/sort_order — this
      // page revalidates via revalidatePath, so the temp id is only visible
      // for the instant before the server component re-fetches.
      onSaved({ id: crypto.randomUUID(), name, icon, is_active: isActive, sort_order: 0, parent_id: null });
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div className="w-full max-w-sm rounded-lg bg-white p-5 shadow-xl">
        <h2 className="mb-4 text-sm font-semibold text-neutral-900">
          {category ? "Edit category" : "New category"}
        </h2>

        <label className="mb-1 block text-xs font-medium text-neutral-600">Name</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="mb-4 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-900"
          placeholder="e.g. Restaurants"
        />

        <label className="mb-1 block text-xs font-medium text-neutral-600">Icon</label>
        <div className="mb-4">
          <IconPicker value={icon} onChange={setIcon} />
        </div>

        <label className="mb-4 flex items-center gap-2 text-sm text-neutral-700">
          <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
          Visible in the app
        </label>

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

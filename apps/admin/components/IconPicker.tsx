"use client";

import { useRef, useState } from "react";
import { Upload, X, Loader2 } from "lucide-react";
import { CATEGORY_ICONS } from "@/lib/icons";
import { createClient } from "@/lib/supabase/client";

const MAX_BYTES = 1024 * 1024; // matches the category-icons bucket's file_size_limit
const ACCEPTED_TYPES = ["image/png", "image/jpeg", "image/svg+xml", "image/webp"];

export interface IconValue {
  icon: string;
  iconUrl: string | null;
}

/**
 * Lets an admin either pick from the curated Lucide set (lib/icons.ts) or
 * upload their own image, which is stored in the public `category-icons`
 * Supabase Storage bucket (supabase/migrations/0006_category_icon_uploads.sql).
 * `icon` is always kept in sync with a name — either the selected preset, or
 * "Store" as a harmless fallback while a custom image is active — so
 * getCategoryIcon() never has nothing to fall back to if iconUrl 404s.
 */
export function IconPicker({ value, onChange }: { value: IconValue; onChange: (next: IconValue) => void }) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  async function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // let the same file be picked again after an error
    if (!file) return;

    setUploadError(null);

    if (!ACCEPTED_TYPES.includes(file.type)) {
      setUploadError("Use a PNG, JPEG, WebP, or SVG image.");
      return;
    }
    if (file.size > MAX_BYTES) {
      setUploadError("Image is too large — max 1 MB.");
      return;
    }

    setUploading(true);
    const supabase = createClient();
    const ext = file.name.split(".").pop() || "png";
    const path = `${crypto.randomUUID()}.${ext}`;

    const { error } = await supabase.storage.from("category-icons").upload(path, file, {
      cacheControl: "31536000",
      upsert: false,
    });

    if (error) {
      setUploading(false);
      setUploadError(error.message);
      return;
    }

    const { data } = supabase.storage.from("category-icons").getPublicUrl(path);
    setUploading(false);
    onChange({ icon: value.icon, iconUrl: data.publicUrl });
  }

  if (value.iconUrl) {
    return (
      <div className="flex items-center gap-3 rounded-md border border-neutral-200 p-3">
        {/* eslint-disable-next-line @next/next/no-img-element -- external Supabase Storage URL, not a local/optimizable asset */}
        <img src={value.iconUrl} alt="" className="h-12 w-12 rounded-md border border-neutral-200 object-cover" />
        <div className="flex-1 text-xs text-neutral-500">Custom uploaded image</div>
        <button
          type="button"
          onClick={() => onChange({ icon: value.icon, iconUrl: null })}
          className="flex items-center gap-1 rounded-md border border-neutral-300 px-2 py-1 text-xs text-neutral-600 hover:bg-neutral-100"
        >
          <X size={13} /> Remove
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="grid grid-cols-8 gap-2 rounded-md border border-neutral-200 p-3">
        {CATEGORY_ICONS.map(({ name, icon: Icon }) => {
          const selected = value.icon === name;
          return (
            <button
              key={name}
              type="button"
              title={name}
              onClick={() => onChange({ icon: name, iconUrl: null })}
              className={`flex h-9 w-9 items-center justify-center rounded-md border ${
                selected
                  ? "border-neutral-900 bg-neutral-900 text-white"
                  : "border-neutral-200 text-neutral-600 hover:border-neutral-400"
              }`}
            >
              <Icon size={18} />
            </button>
          );
        })}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPTED_TYPES.join(",")}
        onChange={handleFileSelected}
        className="hidden"
      />
      <button
        type="button"
        disabled={uploading}
        onClick={() => fileInputRef.current?.click()}
        className="mt-2 flex w-full items-center justify-center gap-2 rounded-md border border-dashed border-neutral-300 px-3 py-2 text-xs font-medium text-neutral-600 hover:border-neutral-400 hover:bg-neutral-50 disabled:opacity-50"
      >
        {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
        {uploading ? "Uploading…" : "Upload your own image instead"}
      </button>
      {uploadError && <p className="mt-1 text-xs text-red-600">{uploadError}</p>}
    </div>
  );
}

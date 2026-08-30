"use client";

import { useRef, useState } from "react";
import { Upload, X, Loader2, ImageIcon } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const MAX_BYTES = 5 * 1024 * 1024; // matches the target bucket's file_size_limit
const ACCEPTED_TYPES = ["image/png", "image/jpeg", "image/webp"];

/**
 * A single required header-image uploader. Used for a shop's mandatory
 * banner_image_url (bucket "shop-banners") and for each row in the Banners
 * feature (bucket "banners") — same upload mechanics, different bucket, so
 * the bucket is a prop rather than hardcoded.
 */
export function BannerImagePicker({
  bucket,
  value,
  onChange,
  aspectHint = "Wide header image — 16:9 or wider works best.",
}: {
  bucket: "shop-banners" | "banners";
  value: string | null;
  onChange: (url: string | null) => void;
  aspectHint?: string;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  async function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setUploadError(null);
    if (!ACCEPTED_TYPES.includes(file.type)) {
      setUploadError("Use a PNG, JPEG, or WebP image.");
      return;
    }
    if (file.size > MAX_BYTES) {
      setUploadError("Image is too large — max 5 MB.");
      return;
    }

    setUploading(true);
    const supabase = createClient();
    const ext = file.name.split(".").pop() || "jpg";
    const path = `${crypto.randomUUID()}.${ext}`;

    const { error } = await supabase.storage.from(bucket).upload(path, file, {
      cacheControl: "31536000",
      upsert: false,
    });

    if (error) {
      setUploading(false);
      setUploadError(error.message);
      return;
    }

    const { data } = supabase.storage.from(bucket).getPublicUrl(path);
    setUploading(false);
    onChange(data.publicUrl);
  }

  if (value) {
    return (
      <div className="overflow-hidden rounded-md border border-neutral-200">
        {/* eslint-disable-next-line @next/next/no-img-element -- external Supabase Storage URL, not a local/optimizable asset */}
        <img src={value} alt="" className="h-32 w-full object-cover" />
        <div className="flex items-center justify-between px-3 py-2">
          <span className="text-xs text-neutral-500">Uploaded</span>
          <button
            type="button"
            onClick={() => onChange(null)}
            className="flex items-center gap-1 rounded-md border border-neutral-300 px-2 py-1 text-xs text-neutral-600 hover:bg-neutral-100"
          >
            <X size={13} /> Remove
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
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
        className="flex h-32 w-full flex-col items-center justify-center gap-1.5 rounded-md border border-dashed border-neutral-300 text-neutral-500 hover:border-neutral-400 hover:bg-neutral-50 disabled:opacity-50"
      >
        {uploading ? <Loader2 size={18} className="animate-spin" /> : <ImageIcon size={18} />}
        <span className="flex items-center gap-1.5 text-xs font-medium">
          {uploading ? "Uploading…" : (
            <>
              <Upload size={12} /> Upload banner image
            </>
          )}
        </span>
        <span className="text-[11px] text-neutral-400">{aspectHint}</span>
      </button>
      {uploadError && <p className="mt-1 text-xs text-red-600">{uploadError}</p>}
    </div>
  );
}

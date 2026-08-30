"use client";

import { useRef, useState } from "react";
import { Upload, X, Loader2, ChevronUp, ChevronDown, FileText } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const MAX_BYTES = 10 * 1024 * 1024; // matches the shop-menus bucket's file_size_limit
const ACCEPTED_TYPES = ["image/png", "image/jpeg", "image/webp", "application/pdf"];

function isPdfUrl(url: string): boolean {
  return url.split("?")[0].toLowerCase().endsWith(".pdf");
}

/**
 * Multi-file uploader for a shop's menu (photos of physical menu pages, or a
 * scanned PDF) — bucket "shop-menus" (supabase/migrations/0010_shop_banner_and_menu_uploads.sql).
 * Order matters (it's the page order customers see), so entries can be
 * reordered the same up/down way CategoriesManager reorders the category
 * list — but purely in local state here, since menu_images is just an array
 * column saved together with the rest of the shop form, not its own
 * persisted ordering that needs a dedicated server action.
 */
export function MenuUploader({ value, onChange }: { value: string[]; onChange: (urls: string[]) => void }) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  async function handleFilesSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (files.length === 0) return;

    setUploadError(null);
    for (const file of files) {
      if (!ACCEPTED_TYPES.includes(file.type)) {
        setUploadError(`${file.name}: use a PNG, JPEG, WebP, or PDF.`);
        return;
      }
      if (file.size > MAX_BYTES) {
        setUploadError(`${file.name}: too large — max 10 MB.`);
        return;
      }
    }

    setUploading(true);
    const supabase = createClient();
    const uploaded: string[] = [];
    for (const file of files) {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from("shop-menus").upload(path, file, {
        cacheControl: "31536000",
        upsert: false,
      });
      if (error) {
        setUploading(false);
        setUploadError(error.message);
        return;
      }
      const { data } = supabase.storage.from("shop-menus").getPublicUrl(path);
      uploaded.push(data.publicUrl);
    }
    setUploading(false);
    onChange([...value, ...uploaded]);
  }

  function remove(index: number) {
    onChange(value.filter((_, i) => i !== index));
  }

  function move(index: number, direction: "up" | "down") {
    const swap = direction === "up" ? index - 1 : index + 1;
    if (swap < 0 || swap >= value.length) return;
    const next = [...value];
    [next[index], next[swap]] = [next[swap], next[index]];
    onChange(next);
  }

  return (
    <div>
      {value.length > 0 && (
        <div className="mb-2 grid grid-cols-4 gap-2">
          {value.map((url, i) => (
            <div key={url} className="group relative overflow-hidden rounded-md border border-neutral-200">
              {isPdfUrl(url) ? (
                <div className="flex h-20 w-full flex-col items-center justify-center gap-1 bg-neutral-50 text-neutral-500">
                  <FileText size={18} />
                  <span className="text-[10px]">PDF</span>
                </div>
              ) : (
                // eslint-disable-next-line @next/next/no-img-element -- external Supabase Storage URL, not a local/optimizable asset
                <img src={url} alt="" className="h-20 w-full object-cover" />
              )}
              <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-black/50 px-1 py-0.5 opacity-0 group-hover:opacity-100">
                <div className="flex">
                  <button
                    type="button"
                    disabled={i === 0}
                    onClick={() => move(i, "up")}
                    className="text-white disabled:opacity-30"
                    title="Move earlier"
                  >
                    <ChevronUp size={13} />
                  </button>
                  <button
                    type="button"
                    disabled={i === value.length - 1}
                    onClick={() => move(i, "down")}
                    className="text-white disabled:opacity-30"
                    title="Move later"
                  >
                    <ChevronDown size={13} />
                  </button>
                </div>
                <button type="button" onClick={() => remove(i)} className="text-white hover:text-red-300" title="Remove">
                  <X size={13} />
                </button>
              </div>
              <span className="absolute left-1 top-1 rounded bg-black/50 px-1 text-[10px] text-white">{i + 1}</span>
            </div>
          ))}
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPTED_TYPES.join(",")}
        multiple
        onChange={handleFilesSelected}
        className="hidden"
      />
      <button
        type="button"
        disabled={uploading}
        onClick={() => fileInputRef.current?.click()}
        className="flex w-full items-center justify-center gap-2 rounded-md border border-dashed border-neutral-300 px-3 py-2 text-xs font-medium text-neutral-600 hover:border-neutral-400 hover:bg-neutral-50 disabled:opacity-50"
      >
        {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
        {uploading ? "Uploading…" : value.length > 0 ? "Add more menu pages" : "Upload menu photos or PDF"}
      </button>
      {uploadError && <p className="mt-1 text-xs text-red-600">{uploadError}</p>}
    </div>
  );
}

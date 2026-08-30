"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { FilterOptions } from "./lib";

// Small client wrapper around three <select> filters. Read-only reporting
// pages don't need the client-state/server-action machinery the CRUD
// managers use — updating the URL's searchParams is enough, and keeps
// the filtered view shareable/bookmarkable.
export function FilterBar({ options }: { options: FilterOptions }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function setParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="mb-4 flex flex-wrap items-center gap-3">
      <select
        value={searchParams.get("category") ?? ""}
        onChange={(e) => setParam("category", e.target.value)}
        className="rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-900"
      >
        <option value="">All categories</option>
        {options.categories.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>

      <select
        value={searchParams.get("shop") ?? ""}
        onChange={(e) => setParam("shop", e.target.value)}
        className="rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-900"
      >
        <option value="">All shops</option>
        {options.shops.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </select>

      <select
        value={searchParams.get("city") ?? ""}
        onChange={(e) => setParam("city", e.target.value)}
        className="rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-900"
      >
        <option value="">All cities</option>
        {options.cities.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>

      {(searchParams.get("category") || searchParams.get("shop") || searchParams.get("city")) && (
        <button
          onClick={() => router.push(pathname)}
          className="text-sm text-neutral-500 underline hover:text-neutral-900"
        >
          Clear filters
        </button>
      )}
    </div>
  );
}

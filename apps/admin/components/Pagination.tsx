"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

// Client-side pager: every list in this admin panel already loads its full
// result set up front (see OffersManager, ShopsManager, UsersTable), so
// pagination here just slices an already-fetched array rather than
// re-querying Supabase per page. Revisit with real offset/cursor queries if
// any of these lists grow past what's reasonable to load in one request.
export function Pagination({
  page,
  pageCount,
  onPageChange,
}: {
  page: number;
  pageCount: number;
  onPageChange: (page: number) => void;
}) {
  if (pageCount <= 1) return null;

  const pages = pageNumbers(page, pageCount);

  return (
    <div className="mt-4 flex items-center justify-center gap-1">
      <button
        onClick={() => onPageChange(page - 1)}
        disabled={page === 1}
        className="flex items-center gap-1 rounded-md px-2 py-1.5 text-sm font-medium text-neutral-600 hover:bg-neutral-100 disabled:opacity-40 disabled:hover:bg-transparent"
      >
        <ChevronLeft size={14} /> Prev
      </button>
      {pages.map((p, i) =>
        p === "…" ? (
          <span key={`ellipsis-${i}`} className="px-2 text-sm text-neutral-400">
            …
          </span>
        ) : (
          <button
            key={p}
            onClick={() => onPageChange(p)}
            className={`min-w-[32px] rounded-md px-2 py-1.5 text-center text-sm font-medium ${
              p === page ? "bg-neutral-900 text-white" : "text-neutral-600 hover:bg-neutral-100"
            }`}
          >
            {p}
          </button>
        )
      )}
      <button
        onClick={() => onPageChange(page + 1)}
        disabled={page === pageCount}
        className="flex items-center gap-1 rounded-md px-2 py-1.5 text-sm font-medium text-neutral-600 hover:bg-neutral-100 disabled:opacity-40 disabled:hover:bg-transparent"
      >
        Next <ChevronRight size={14} />
      </button>
    </div>
  );
}

// Full run for <=7 pages; otherwise first 2, last 2, and a window around
// the current page, with "…" filling the gaps — standard truncated
// pagination so this stays usable once a list runs into the hundreds.
function pageNumbers(current: number, total: number): (number | "…")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const keep = new Set<number>([1, 2, total - 1, total, current - 1, current, current + 1]);
  const sorted = [...keep].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b);
  const result: (number | "…")[] = [];
  let prev = 0;
  for (const p of sorted) {
    if (prev && p - prev > 1) result.push("…");
    result.push(p);
    prev = p;
  }
  return result;
}

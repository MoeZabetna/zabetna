import Link from "next/link";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";

export function SortLink({
  label,
  sortKey,
  currentSort,
  currentDir,
  queryString,
}: {
  label: string;
  sortKey: "name" | "quantity";
  currentSort: string;
  currentDir: "asc" | "desc";
  queryString: string;
}) {
  const isActive = currentSort === sortKey;
  const nextDir = isActive && currentDir === "desc" ? "asc" : "desc";
  const params = new URLSearchParams(queryString);
  params.set("sort", sortKey);
  params.set("dir", nextDir);

  const Icon = isActive ? (currentDir === "desc" ? ArrowDown : ArrowUp) : ArrowUpDown;

  return (
    <Link href={`?${params.toString()}`} className="flex items-center gap-1 hover:text-neutral-900">
      {label}
      <Icon size={12} className={isActive ? "text-neutral-700" : "text-neutral-300"} />
    </Link>
  );
}

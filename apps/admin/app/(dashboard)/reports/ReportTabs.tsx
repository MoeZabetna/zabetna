import Link from "next/link";

// `queryString` carries the current category/shop/city filters across tabs
// (e.g. "?category=...&city=Beirut") so switching Overall <-> Daily keeps
// whatever the admin was already filtering to, instead of resetting it.
export function ReportTabs({ active, queryString }: { active: "overall" | "daily"; queryString: string }) {
  const suffix = queryString ? `?${queryString}` : "";
  const tabs = [
    { key: "overall" as const, href: `/reports${suffix}`, label: "Overall redemption" },
    { key: "daily" as const, href: `/reports/daily${suffix}`, label: "Daily performance" },
  ];
  return (
    <div className="mb-4 flex gap-1 border-b border-neutral-200">
      {tabs.map((tab) => (
        <Link
          key={tab.key}
          href={tab.href}
          className={`border-b-2 px-3 py-2 text-sm font-medium ${
            active === tab.key
              ? "border-neutral-900 text-neutral-900"
              : "border-transparent text-neutral-500 hover:text-neutral-900"
          }`}
        >
          {tab.label}
        </Link>
      ))}
    </div>
  );
}

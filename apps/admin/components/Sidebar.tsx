"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutGrid, Store, Tag, Image as ImageIcon, BarChart3, ShieldCheck } from "lucide-react";

const NAV = [
  { href: "/categories", label: "Categories", icon: LayoutGrid, permission: "content.manage" },
  { href: "/shops", label: "Shops", icon: Store, permission: "shops.manage" },
  { href: "/offers", label: "Offers", icon: Tag, permission: "shops.manage" },
  { href: "/banners", label: "Banners", icon: ImageIcon, permission: "content.manage" },
  { href: "/reports", label: "Reports", icon: BarChart3, permission: "reports.view" },
  { href: "/admins", label: "Admins", icon: ShieldCheck, permission: "admins.manage" },
];

export function Sidebar({ permissions }: { permissions: string[] }) {
  const pathname = usePathname();
  const visible = NAV.filter((item) => permissions.includes(item.permission));

  return (
    <nav className="flex w-56 shrink-0 flex-col gap-1 border-r border-neutral-200 bg-white p-4">
      <div className="mb-6 px-2 text-lg font-semibold text-neutral-900">Zabetna</div>
      {visible.map((item) => {
        const active = pathname.startsWith(item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium ${
              active ? "bg-neutral-900 text-white" : "text-neutral-600 hover:bg-neutral-100"
            }`}
          >
            <Icon size={16} />
            {item.label}
          </Link>
        );
      })}
      {visible.length === 0 && (
        <p className="px-2 text-xs text-neutral-400">Your role has no visible sections yet.</p>
      )}
    </nav>
  );
}

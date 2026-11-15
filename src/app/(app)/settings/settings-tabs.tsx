"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cx } from "@/components/ui";

const TABS = [
  { href: "/settings", label: "Workshop" },
  { href: "/settings/catalogue", label: "Labour and parts" },
];

export function SettingsTabs() {
  const pathname = usePathname();
  return (
    <nav aria-label="Settings sections" className="mb-6 flex gap-1 border-b border-slate-200">
      {TABS.map((t) => {
        const active = pathname === t.href;
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={active ? "page" : undefined}
            className={cx(
              "-mb-px border-b-2 px-3 py-2 text-sm",
              active ? "border-brand-600 font-medium text-brand-900" : "border-transparent text-slate-600 hover:text-slate-900",
            )}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}

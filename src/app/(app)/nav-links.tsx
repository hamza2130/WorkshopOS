"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cx } from "@/components/ui";

export type NavLink = { href: string; label: string; upcoming: boolean };

export function NavLinks({ items, onNavigate }: { items: NavLink[]; onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <ul className="space-y-0.5">
      {items.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <li key={item.href}>
            <Link
              href={item.href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={cx(
                "flex items-center justify-between rounded-md px-3 py-2 text-sm",
                active ? "bg-brand-50 font-medium text-brand-900" : "text-slate-700 hover:bg-slate-100 hover:text-slate-900",
              )}
            >
              {item.label}
              {item.upcoming ? <span className="text-[10px] uppercase tracking-wide text-slate-400">Soon</span> : null}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

export function MobileNav({ items }: { items: NavLink[] }) {
  return (
    <details className="group lg:hidden">
      <summary className="flex cursor-pointer list-none items-center rounded-md px-2 py-1.5 text-sm font-medium text-slate-700 ring-1 ring-slate-300 hover:bg-slate-50">
        Menu
      </summary>
      <div className="absolute inset-x-0 top-14 z-20 border-b border-slate-200 bg-white p-3 shadow-sm">
        <NavLinks
          items={items}
          onNavigate={() => document.querySelectorAll("details[open]").forEach((d) => d.removeAttribute("open"))}
        />
      </div>
    </details>
  );
}

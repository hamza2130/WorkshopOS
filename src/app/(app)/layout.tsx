import Link from "next/link";
import type { ReactNode } from "react";
import { Logo } from "@/components/logo";
import { Badge } from "@/components/ui";
import { signOut } from "@/app/(auth)/actions";
import { ROLE_LABELS } from "@/lib/auth/permissions";
import { getWorkshopContext } from "@/lib/auth/session";
import { visibleNav } from "@/lib/navigation";
import { MobileNav, NavLinks, type NavLink } from "./nav-links";
import { WorkshopSwitcher } from "./workshop-switcher";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const ctx = await getWorkshopContext();
  const items: NavLink[] = visibleNav(ctx.permissions).map((i) => ({
    href: i.href,
    label: i.label,
    upcoming: i.phase !== undefined,
  }));

  return (
    <div className="flex min-h-screen flex-1">
      <aside className="hidden w-60 shrink-0 flex-col border-r border-slate-200 bg-white lg:flex">
        <div className="flex h-14 items-center border-b border-slate-200 px-5">
          <Link href="/dashboard" className="text-slate-900">
            <Logo />
          </Link>
        </div>
        <nav aria-label="Main" className="flex-1 overflow-y-auto p-3">
          <NavLinks items={items} />
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="relative flex h-14 items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <MobileNav items={items} />
            {ctx.memberships.length > 1 ? (
              <WorkshopSwitcher memberships={ctx.memberships} activeId={ctx.workshop.workshopId} />
            ) : (
              <span className="truncate text-sm font-semibold text-slate-900">{ctx.workshop.workshopName}</span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-medium leading-tight text-slate-900">{ctx.fullName || ctx.email}</p>
              <Badge tone="muted">{ROLE_LABELS[ctx.workshop.role]}</Badge>
            </div>
            <form action={signOut}>
              <button type="submit" className="rounded-md px-2.5 py-1.5 text-sm text-slate-600 hover:bg-slate-100 hover:text-slate-900">
                Log out
              </button>
            </form>
          </div>
        </header>
        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}

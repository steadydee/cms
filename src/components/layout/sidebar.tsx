"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, LayoutGrid, List, PanelLeftClose } from "lucide-react";
import { cn } from "@/lib/utils";

const navigation = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutGrid },
  { label: "Contacts", href: "/contacts", icon: List },
  { label: "Ops", href: "/ops", icon: BarChart3 },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden w-[72px] shrink-0 border-r border-sidebar-border bg-sidebar text-sidebar-foreground md:flex md:flex-col md:items-center md:py-4">
      <Link
        href="/dashboard"
        className="flex h-10 w-10 items-center justify-center rounded-xl border border-sidebar-border bg-sidebar-accent text-[11px] font-semibold tracking-[0.18em] text-white"
        title="Partners"
      >
        OW
      </Link>

      <nav className="mt-8 flex flex-1 flex-col items-center gap-3">
        {navigation.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);

          return (
            <Link
              key={item.href}
              href={item.href}
              title={item.label}
              className={cn(
                "flex h-11 w-11 items-center justify-center rounded-xl transition",
                isActive
                  ? "bg-sidebar-primary text-sidebar-primary-foreground"
                  : "bg-transparent text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-white"
              )}
            >
              <Icon className="h-5 w-5" />
            </Link>
          );
        })}
      </nav>

      <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-sidebar-border bg-sidebar-accent text-sidebar-foreground/65">
        <PanelLeftClose className="h-4 w-4" />
      </div>
    </aside>
  );
}

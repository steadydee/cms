"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft, FolderKanban, LayoutGrid, Search, SquareCheckBig } from "lucide-react";
import { cn } from "@/lib/utils";

const navigation = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutGrid },
  { label: "Accounts", href: "/contacts", icon: FolderKanban },
  { label: "Research", href: "/research", icon: Search },
  { label: "Tasks", href: "/tasks", icon: SquareCheckBig },
];

export function Sidebar({
  hubHref,
  userName,
  role,
  propertyId,
}: {
  hubHref: string;
  userName: string;
  role: string;
  propertyId: string;
}) {
  const pathname = usePathname();
  const userInitial = userName.trim().charAt(0).toUpperCase() || "U";

  return (
    <aside className="hidden w-[228px] shrink-0 border-r border-sidebar-border bg-sidebar px-4 py-5 text-sidebar-foreground md:flex md:flex-col">
      <Link
        href="/dashboard"
        className="flex items-center gap-3 rounded-2xl border border-sidebar-border bg-sidebar-accent px-3 py-3 transition hover:border-sidebar-primary"
        title="Partners"
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sidebar-primary text-[11px] font-semibold tracking-[0.18em] text-sidebar-primary-foreground">
          OW
        </span>
        <span className="min-w-0">
          <span className="block text-[14px] font-semibold text-white">Partners</span>
          <span className="block text-[11px] text-sidebar-foreground/65">Outreach CRM</span>
        </span>
      </Link>

      <nav className="mt-8 flex flex-1 flex-col gap-1.5">
        {navigation.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);

          return (
            <Link
              key={item.href}
              href={item.href}
              title={item.label}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-3 transition",
                isActive
                  ? "bg-sidebar-primary text-sidebar-primary-foreground"
                  : "bg-transparent text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-white"
              )}
            >
              <Icon className="h-5 w-5 shrink-0" />
              <span className="text-[13px] font-medium">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="space-y-3">
        <div
          title={`${userName} · ${role} · ${propertyId}`}
          className="flex items-center gap-3 rounded-2xl border border-sidebar-border bg-sidebar-accent px-3 py-3"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-sidebar-border bg-sidebar text-[12px] font-semibold text-sidebar-foreground/85">
            {userInitial}
          </span>
          <span className="min-w-0">
            <span className="block truncate text-[13px] font-medium text-white">{userName}</span>
            <span className="block truncate text-[11px] text-sidebar-foreground/65">{role}</span>
          </span>
        </div>
        <Link
          href={hubHref}
          title="Back to Hub"
          className="flex items-center justify-between rounded-2xl border border-sidebar-border bg-sidebar-accent px-3 py-3 text-sidebar-foreground/75 transition hover:text-white"
        >
          <span className="text-[13px] font-medium">Back to Hub</span>
          <ArrowLeft className="h-4 w-4 shrink-0" />
        </Link>
      </div>
    </aside>
  );
}

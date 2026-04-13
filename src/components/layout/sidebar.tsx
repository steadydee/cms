"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  LayoutDashboard,
  Building2,
  ListTodo,
  Search,
  Users,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

type NavItem = {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
};

const navigation: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Accounts", href: "/organizations", icon: Building2 },
  { label: "Research", href: "/research", icon: Search },
  { label: "Tasks", href: "/tasks", icon: ListTodo },
];

const HUB_URL =
  process.env.NEXT_PUBLIC_OW_HUB_URL?.trim()
  || process.env.OW_PARTNERS_HUB_URL?.trim()
  || (process.env.NODE_ENV !== "production" ? "http://localhost:3101" : "#");

function NavLink({ item, collapsed }: { item: NavItem; collapsed: boolean }) {
  const pathname = usePathname();
  const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
  const Icon = item.icon;

  if (collapsed) {
    return (
      <Link
        href={item.href}
        className={cn(
          "flex h-10 w-10 items-center justify-center rounded-md transition-colors",
          isActive
            ? "bg-sidebar-accent text-sidebar-accent-foreground"
            : "text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
        )}
        title={item.label}
      >
        <Icon className="h-[18px] w-[18px] shrink-0 opacity-80" />
      </Link>
    );
  }

  return (
    <Link
      href={item.href}
      className={cn(
        "flex items-center gap-3 rounded-md px-3 py-2 text-[13px] font-medium transition-colors",
        isActive
          ? "bg-sidebar-accent text-sidebar-accent-foreground"
          : "text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
      )}
    >
      <Icon className="h-[18px] w-[18px] shrink-0 opacity-80" />
      {item.label}
    </Link>
  );
}

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("ow_partners_sidebar") === "collapsed";
  });

  function toggle() {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem("ow_partners_sidebar", next ? "collapsed" : "expanded");
  }

  return (
    <aside
      className={cn(
        "flex h-full flex-col bg-sidebar text-sidebar-foreground transition-all duration-200",
        collapsed ? "w-[56px]" : "w-[250px]"
      )}
    >
      <div className={cn("flex h-[60px] items-center border-b border-sidebar-border", collapsed ? "justify-center" : "gap-2.5 px-4")}>
        {!collapsed ? (
          <>
            <a
              href={HUB_URL}
              className="flex h-8 w-8 items-center justify-center rounded-md bg-sidebar-primary text-sidebar-primary-foreground text-sm font-bold shrink-0 hover:opacity-80 transition-opacity"
              title="Back to Owl's Watch Hub"
            >
              OW
            </a>
            <div className="min-w-0 flex-1">
              <Link href="/dashboard" className="text-sm font-semibold tracking-tight text-white">
                Owl&apos;s Watch
              </Link>
              <p className="text-[11px] leading-none text-sidebar-foreground/60">Partners CRM</p>
            </div>
            <button
              onClick={toggle}
              className="flex h-8 w-8 items-center justify-center rounded-md text-sidebar-foreground/50 hover:bg-sidebar-accent hover:text-white transition-colors shrink-0"
              title="Collapse sidebar"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
          </>
        ) : (
          <button
            onClick={toggle}
            className="flex h-10 w-10 items-center justify-center rounded-md text-sidebar-foreground/50 hover:bg-sidebar-accent hover:text-white transition-colors"
            title="Expand sidebar"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        )}
      </div>

      <nav className={cn("flex-1 overflow-y-auto space-y-0.5", collapsed ? "flex flex-col items-center gap-1 p-2" : "p-3")}>
        {navigation.map((item) => (
          <NavLink key={item.href} item={item} collapsed={collapsed} />
        ))}
      </nav>

      <div className={cn("border-t border-sidebar-border", collapsed ? "flex justify-center py-3" : "px-4 py-3")}>
        {collapsed ? (
          <Users className="h-4 w-4 text-sidebar-foreground/50" />
        ) : (
          <p className="text-[11px] text-sidebar-foreground/50">Partners v0.1.0</p>
        )}
      </div>
    </aside>
  );
}

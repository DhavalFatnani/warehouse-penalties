"use client";

import type { ComponentType } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ClipboardList,
  FileSpreadsheet,
  Gavel,
  Home,
  LayoutDashboard,
  Shield,
  Upload,
  Users,
  Wallet,
  Warehouse
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/theme-toggle";
import { SignOutButton } from "@/components/sign-out-button";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { AppRole } from "@/lib/auth";

type NavItem = {
  href: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
};

function warehousesNavItem(role: AppRole): NavItem {
  return {
    href:
      role === "admin"
        ? "/dashboard/admin/warehouses"
        : "/dashboard/warehouses",
    label: "Warehouses",
    icon: Warehouse
  };
}

/** Order: landing → daily penalty flow → who/where → rules & bulk tools. */
function buildMainNavSections(
  role: AppRole
): { title: string | null; items: NavItem[] }[] {
  return [
    {
      title: null,
      items: [{ href: "/dashboard", label: "Overview", icon: LayoutDashboard }]
    },
    {
      title: "Penalties",
      items: [
        { href: "/dashboard/apply", label: "Apply penalty", icon: Gavel },
        {
          href: "/dashboard/records",
          label: "Penalty records",
          icon: ClipboardList
        },
        { href: "/dashboard/settlement", label: "Settlement", icon: Wallet }
      ]
    },
    {
      title: "Directory",
      items: [
        { href: "/dashboard/staff", label: "Staff", icon: Users },
        warehousesNavItem(role)
      ]
    },
    {
      title: "Catalog",
      items: [
        {
          href: "/dashboard/penalties",
          label: "Definitions",
          icon: FileSpreadsheet
        },
        { href: "/dashboard/imports", label: "Penalty imports", icon: Upload }
      ]
    }
  ];
}

const adminNav = [
  { href: "/dashboard/admin/users", label: "Users", icon: Shield },
  { href: "/dashboard/admin/access", label: "Warehouse access", icon: Shield },
  { href: "/dashboard/admin/invite", label: "Invite users", icon: Shield }
];

export function SidebarPanel({
  role,
  onNavigate,
  className
}: {
  role: AppRole;
  onNavigate?: () => void;
  className?: string;
}) {
  const pathname = usePathname();

  return (
    <div
      className={cn(
        "flex h-full min-h-0 w-full max-w-[17rem] flex-col border-sidebar-border bg-sidebar text-sidebar-foreground md:border-r",
        className
      )}
    >
      <div className="flex h-14 shrink-0 items-center gap-3 border-b border-sidebar-border px-4">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/15">
          <Home className="h-4 w-4" aria-hidden />
        </div>
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold leading-tight tracking-tight">
            Penalty Platform
          </div>
          <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            Operations
          </div>
        </div>
      </div>
      <ScrollArea className="flex-1 px-2 py-3">
        <nav className="space-y-3" aria-label="Main">
          {buildMainNavSections(role).map((section, idx) => (
            <div
              key={section.title ?? `head-${idx}`}
              className="space-y-0.5"
            >
              {section.title ? (
                <p className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {section.title}
                </p>
              ) : null}
              {section.items.map((item) => (
                <SidebarLink
                  key={`${item.label}-${item.href}`}
                  {...item}
                  active={isMainNavActive(pathname, item.href)}
                  onNavigate={onNavigate}
                />
              ))}
            </div>
          ))}
        </nav>
        {role === "admin" ? (
          <>
            <Separator className="my-3 bg-sidebar-border" />
            <p className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Admin
            </p>
            <nav className="space-y-0.5" aria-label="Administration">
              {adminNav.map((item) => (
                <SidebarLink
                  key={item.href}
                  {...item}
                  active={pathname.startsWith(item.href)}
                  onNavigate={onNavigate}
                />
              ))}
            </nav>
          </>
        ) : null}
      </ScrollArea>
      <div className="flex shrink-0 items-center justify-between gap-2 border-t border-sidebar-border p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
        <ThemeToggle />
        <SignOutButton />
      </div>
    </div>
  );
}

function isMainNavActive(pathname: string, href: string) {
  if (pathname === href) return true;
  if (href === "/dashboard") return false;
  if (href === "/dashboard/warehouses") {
    return (
      pathname.startsWith("/dashboard/warehouses") ||
      pathname.startsWith("/dashboard/admin/warehouses")
    );
  }
  return pathname.startsWith(href);
}

function SidebarLink({
  href,
  label,
  icon: Icon,
  active,
  onNavigate
}: {
  href: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  active: boolean;
  onNavigate?: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={() => onNavigate?.()}
      className={cn(
        "group flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm outline-none transition-all duration-200",
        "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar",
        active
          ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground shadow-sm ring-1 ring-sidebar-border/80"
          : "text-muted-foreground hover:bg-sidebar-accent/70 hover:text-sidebar-accent-foreground"
      )}
    >
      <Icon
        className={cn(
          "h-4 w-4 shrink-0 transition-transform duration-200 group-hover:scale-105",
          active ? "text-primary" : "opacity-85"
        )}
        aria-hidden
      />
      {label}
    </Link>
  );
}

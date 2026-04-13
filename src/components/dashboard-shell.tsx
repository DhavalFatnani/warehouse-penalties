"use client";

import {
  useCallback,
  useEffect,
  useState,
  type ReactNode
} from "react";
import { usePathname } from "next/navigation";
import { Menu, PanelLeft, Keyboard } from "lucide-react";
import { SidebarPanel } from "@/components/sidebar-panel";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import type { AppRole } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { DashboardWarehouseSelect } from "@/components/dashboard-warehouse-context";

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  if (target.isContentEditable) return true;
  return false;
}

export function DashboardShell({
  role,
  children
}: {
  role: AppRole;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const toggleNav = useCallback(() => {
    setMobileOpen((o) => !o);
  }, []);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (isEditableTarget(e.target)) return;

      if (e.key === "Escape") {
        setMobileOpen(false);
        setShortcutsOpen(false);
        return;
      }

      const mod = e.metaKey || e.ctrlKey;
      if (mod && (e.key === "b" || e.key === "B")) {
        e.preventDefault();
        if (window.matchMedia("(max-width: 767px)").matches) {
          toggleNav();
        }
      }
      if (mod && e.key === "/") {
        e.preventDefault();
        setShortcutsOpen(true);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [toggleNav]);

  return (
    <div className="flex h-[100dvh] w-full overflow-hidden">
        <aside className="hidden w-[240px] shrink-0 overflow-x-hidden md:block lg:w-[260px]">
          <div className="h-full min-w-0">
            <SidebarPanel role={role} />
          </div>
        </aside>

        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <header
            className={cn(
              "sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 border-b border-border/80 bg-background/80 px-3 backdrop-blur-md",
              "md:hidden"
            )}
          >
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="shrink-0 transition-transform duration-200 active:scale-95"
                  aria-label="Open navigation menu"
                >
                  <Menu className="h-5 w-5" aria-hidden />
                </Button>
              </SheetTrigger>
              <SheetContent
                side="left"
                className="w-[min(100vw-2rem,18rem)] border-sidebar-border bg-sidebar p-0 [&>button]:text-sidebar-foreground"
              >
                <SidebarPanel
                  role={role}
                  onNavigate={() => setMobileOpen(false)}
                />
              </SheetContent>
            </Sheet>
            <DashboardWarehouseSelect compact className="min-w-0 shrink" />
            <div className="min-w-0 flex-1 text-right">
              <p className="truncate text-sm font-semibold tracking-tight">
                Warehouse payroll
              </p>
              <p className="truncate text-[11px] text-muted-foreground">
                Operations
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="shrink-0 text-muted-foreground"
              aria-label="Keyboard shortcuts"
              onClick={() => setShortcutsOpen(true)}
            >
              <Keyboard className="h-5 w-5" aria-hidden />
            </Button>
          </header>

        <main className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-4 py-6 sm:px-6 md:px-8 md:py-8">
          <div key={pathname} className="animate-fade-up">
            {children}
          </div>
        </main>
      </div>

      <Dialog open={shortcutsOpen} onOpenChange={setShortcutsOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PanelLeft className="h-5 w-5 text-primary" aria-hidden />
              Keyboard shortcuts
            </DialogTitle>
            <DialogDescription>
              Speed up common actions. Shortcuts are disabled while typing in a
              field.
            </DialogDescription>
          </DialogHeader>
          <ul className="space-y-4 text-sm">
            <ShortcutRow label="Toggle sidebar (small screens only)">
              <KeyGroup keys={["⌘", "B"]} />
              <span className="text-muted-foreground">·</span>
              <KeyGroup keys={["Ctrl", "B"]} />
            </ShortcutRow>
            <ShortcutRow label="Open this shortcuts panel">
              <KeyGroup keys={["⌘", "/"]} />
              <span className="text-muted-foreground">·</span>
              <KeyGroup keys={["Ctrl", "/"]} />
            </ShortcutRow>
            <ShortcutRow label="Close menus or dialogs">
              <KeyGroup keys={["Esc"]} />
            </ShortcutRow>
          </ul>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ShortcutRow({
  label,
  children
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <li className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className="flex flex-wrap items-center gap-1.5">{children}</span>
    </li>
  );
}

function KeyGroup({ keys }: { keys: string[] }) {
  return (
    <span className="inline-flex items-center gap-0.5 rounded-md border border-border bg-muted px-1 py-0.5 font-mono text-[11px] font-medium shadow-sm">
      {keys.map((k, i) => (
        <span key={`${k}-${i}`} className="px-0.5">
          {k}
        </span>
      ))}
    </span>
  );
}

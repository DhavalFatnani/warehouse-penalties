"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { AppRole } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";

type WarehouseRow = {
  id: string;
  code: string;
  name: string;
  is_active?: boolean;
};

type DashboardWarehouseContextValue = {
  /** Empty string = all sites (admin only). */
  warehouseId: string;
  warehouses: WarehouseRow[];
  warehousesLoading: boolean;
  /** Pass "" for admin “all sites”. */
  setWarehouseId: (id: string) => void;
  /** Append `warehouse_id` to dashboard links (skips admin routes). */
  hrefWithWarehouse: (href: string) => string;
  userRole: AppRole;
};

const DashboardWarehouseContext =
  createContext<DashboardWarehouseContextValue | null>(null);

export function useDashboardWarehouse(): DashboardWarehouseContextValue {
  const ctx = useContext(DashboardWarehouseContext);
  if (!ctx) {
    throw new Error(
      "useDashboardWarehouse must be used within DashboardWarehouseProvider"
    );
  }
  return ctx;
}

/** Optional: returns null outside provider (e.g. tests). */
export function useDashboardWarehouseOptional(): DashboardWarehouseContextValue | null {
  return useContext(DashboardWarehouseContext);
}

function shouldAttachWarehouseToHref(href: string): boolean {
  if (!href.startsWith("/dashboard")) return false;
  if (href.startsWith("/dashboard/admin")) return false;
  return true;
}

export function appendWarehouseToHref(
  href: string,
  warehouseId: string
): string {
  if (!warehouseId || !shouldAttachWarehouseToHref(href)) return href;
  const [path, query] = href.split("?");
  const params = new URLSearchParams(query ?? "");
  params.set("warehouse_id", warehouseId);
  return `${path}?${params.toString()}`;
}

export function DashboardWarehouseProvider({
  userRole,
  children
}: {
  userRole: AppRole;
  children: ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const warehouseId = searchParams.get("warehouse_id") ?? "";

  const [warehouses, setWarehouses] = useState<WarehouseRow[]>([]);
  const [warehousesLoading, setWarehousesLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/warehouses?include_inactive=true")
      .then((r) => r.json())
      .then((j) => {
        if (cancelled) return;
        const list = (j.data ?? []) as Record<string, unknown>[];
        setWarehouses(
          list.map((w) => ({
            id: String(w.id),
            code: String(w.code ?? ""),
            name: String(w.name ?? ""),
            is_active: w.is_active !== false
          }))
        );
      })
      .finally(() => {
        if (!cancelled) setWarehousesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const setWarehouseId = useCallback(
    (id: string) => {
      const p = new URLSearchParams(searchParams.toString());
      if (!id) p.delete("warehouse_id");
      else p.set("warehouse_id", id);
      const qs = p.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, {
        scroll: false
      });
    },
    [router, pathname, searchParams]
  );

  /** Managers: default to first accessible site when none selected. */
  useEffect(() => {
    if (userRole !== "manager") return;
    if (warehouseId) return;
    if (warehousesLoading || warehouses.length === 0) return;
    setWarehouseId(warehouses[0].id);
  }, [
    userRole,
    warehouseId,
    warehouses,
    warehousesLoading,
    setWarehouseId
  ]);

  const hrefWithWarehouse = useCallback(
    (href: string) => appendWarehouseToHref(href, warehouseId),
    [warehouseId]
  );

  const value = useMemo(
    () => ({
      warehouseId,
      warehouses,
      warehousesLoading,
      setWarehouseId,
      hrefWithWarehouse,
      userRole
    }),
    [
      warehouseId,
      warehouses,
      warehousesLoading,
      setWarehouseId,
      hrefWithWarehouse,
      userRole
    ]
  );

  return (
    <DashboardWarehouseContext.Provider value={value}>
      {children}
    </DashboardWarehouseContext.Provider>
  );
}

/** Sidebar / mobile: global site scope for the dashboard (URL `warehouse_id`). */
export function DashboardWarehouseSelect({
  className,
  compact
}: {
  className?: string;
  compact?: boolean;
}) {
  const ctx = useDashboardWarehouseOptional();
  if (!ctx) {
    return compact ? null : (
      <div className={className} aria-hidden />
    );
  }
  const {
    warehouseId,
    warehouses,
    warehousesLoading,
    setWarehouseId,
    userRole
  } = ctx;

  const showAll = userRole === "admin";
  const selectValue =
    userRole === "manager"
      ? warehouseId || warehouses[0]?.id || ""
      : warehouseId
        ? warehouseId
        : showAll
          ? "__all__"
          : "";
  const singleManagerSite = userRole === "manager" && warehouses.length === 1;
  const disabled = warehousesLoading || warehouses.length === 0;

  return (
    <div
      className={cn("w-full min-w-0", !compact && "px-2", className)}
      data-compact={compact ? "true" : undefined}
    >
      <Label
        htmlFor="dash-wh-scope"
        className={
          compact
            ? "sr-only"
            : "mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground"
        }
      >
        Site scope
      </Label>
      <Select
        value={selectValue || undefined}
        onValueChange={(v) => setWarehouseId(v === "__all__" ? "" : v)}
        disabled={disabled}
      >
        <SelectTrigger
          id="dash-wh-scope"
          className={
            compact
              ? "h-9 w-[min(100%,11rem)] min-w-0 bg-background text-xs"
              : "h-9 min-w-0 w-full max-w-full bg-sidebar-accent/40 text-sm"
          }
          aria-label="Site scope"
        >
          <SelectValue
            placeholder={
              warehousesLoading ? "Loading sites…" : "Select site"
            }
          />
        </SelectTrigger>
        <SelectContent>
          {showAll ? (
            <SelectItem value="__all__">All warehouses</SelectItem>
          ) : null}
          {warehouses.map((w) => (
            <SelectItem key={w.id} value={w.id}>
              <span className="font-mono text-xs">{w.code}</span>
              <span className="text-muted-foreground">
                {" "}
                — {w.name}
                {w.is_active === false ? " (inactive)" : ""}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {singleManagerSite ? (
        <p className="mt-1 text-[10px] text-muted-foreground">
          Your access is limited to this site.
        </p>
      ) : null}
    </div>
  );
}

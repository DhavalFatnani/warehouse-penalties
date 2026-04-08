"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import {
  StaffAddPanel,
  type StaffPageRefs
} from "@/components/staff-add-panel";
import { StaffBulkImportPanel } from "@/components/staff-bulk-import-panel";
import { Search, Users, ChevronRight } from "lucide-react";

type StaffRow = {
  id: string;
  full_name: string;
  employee_code: string;
  phone: string | null;
  is_active: boolean;
  warehouse_id: string | null;
  staff_type_id: string;
  warehouse_code: string | null;
  warehouse_name: string | null;
  staff_type_code: string;
  staff_type_name: string;
};

const TAB_VALUES = ["directory", "add", "bulk"] as const;
type TabValue = (typeof TAB_VALUES)[number];

function parseTab(v: string | null): TabValue {
  if (v === "add" || v === "bulk" || v === "directory") return v;
  return "directory";
}

function mapStaff(r: Record<string, unknown>): StaffRow {
  const wh = r.warehouses as { code?: string; name?: string } | null;
  const st = r.staff_types as { code?: string; display_name?: string } | null;
  return {
    id: String(r.id),
    full_name: String(r.full_name ?? ""),
    employee_code: String(r.employee_code ?? ""),
    phone: r.phone != null ? String(r.phone) : null,
    is_active: Boolean(r.is_active),
    warehouse_id: r.warehouse_id != null ? String(r.warehouse_id) : null,
    staff_type_id: String(r.staff_type_id ?? ""),
    warehouse_code: wh?.code ?? null,
    warehouse_name: wh?.name ?? null,
    staff_type_code: st?.code ?? "—",
    staff_type_name: st?.display_name ?? st?.code ?? "—"
  };
}

function StaffHubContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tab = parseTab(searchParams.get("tab"));

  const [rows, setRows] = useState<StaffRow[]>([]);
  const [q, setQ] = useState("");
  const [activeFilter, setActiveFilter] = useState<"all" | "active" | "inactive">(
    "all"
  );
  const [staffRefs, setStaffRefs] = useState<StaffPageRefs | null>(null);

  const loadStaff = useCallback(() => {
    const p = new URLSearchParams();
    if (activeFilter === "active") p.set("is_active", "true");
    if (activeFilter === "inactive") p.set("is_active", "false");
    if (activeFilter === "all") p.set("include_inactive", "true");
    const qs = p.toString();
    void fetch(`/api/staff?${qs}`)
      .then((r) => r.json())
      .then((j) => {
        const raw = (j.data ?? []) as Record<string, unknown>[];
        setRows(raw.map(mapStaff));
      });
  }, [activeFilter]);

  useEffect(() => {
    if (tab === "directory") {
      loadStaff();
    }
  }, [tab, loadStaff]);

  useEffect(() => {
    let cancelled = false;
    void Promise.all([
      fetch("/api/warehouses").then((r) => r.json()),
      fetch("/api/staff-types").then((r) => r.json())
    ]).then(([whJson, tJson]) => {
      if (cancelled) return;
      setStaffRefs({
        warehouses: (whJson.data ?? []) as StaffPageRefs["warehouses"],
        types: (tJson.data ?? []) as StaffPageRefs["types"]
      });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter((r) => {
      const wh =
        `${r.warehouse_code ?? ""} ${r.warehouse_name ?? ""}`.toLowerCase();
      const type =
        `${r.staff_type_code} ${r.staff_type_name}`.toLowerCase();
      return (
        r.full_name.toLowerCase().includes(s) ||
        r.employee_code.toLowerCase().includes(s) ||
        (r.phone?.toLowerCase().includes(s) ?? false) ||
        wh.includes(s) ||
        type.includes(s)
      );
    });
  }, [rows, q]);

  const counts = useMemo(() => {
    const active = rows.filter((r) => r.is_active).length;
    const inactive = rows.length - active;
    return { active, inactive, total: rows.length };
  }, [rows]);

  function setTab(next: string) {
    const t = parseTab(next);
    router.replace(`/dashboard/staff?tab=${t}`);
  }

  return (
    <div className="w-full max-w-[min(100%,96rem)] space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Staff</h1>
        <p className="text-sm text-muted-foreground">
          Directory, add one person, or bulk CSV. Records are never deleted.
        </p>
      </div>

      <Tabs value={tab} onValueChange={setTab} className="w-full space-y-5">
        <TabsList className="grid h-11 w-full grid-cols-3 rounded-lg border border-border/80 bg-muted/50 p-1 md:inline-flex md:h-11 md:w-auto">
          <TabsTrigger value="directory" className="gap-1.5 sm:px-4">
            <Users className="hidden h-4 w-4 sm:inline" aria-hidden />
            Directory
          </TabsTrigger>
          <TabsTrigger value="add" className="sm:px-4">
            Add staff
          </TabsTrigger>
          <TabsTrigger value="bulk" className="sm:px-4">
            Bulk add
          </TabsTrigger>
        </TabsList>

        <TabsContent value="directory" className="mt-0 outline-none">
          <Card className="overflow-hidden shadow-sm">
            <CardHeader className="border-b bg-muted/30 pb-4 pt-5">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                <div className="space-y-1">
                  <CardTitle className="text-lg">Staff directory</CardTitle>
                  <CardDescription className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span>
                      <span className="font-medium text-foreground tabular-nums">
                        {filtered.length}
                      </span>
                      {q.trim() ? " match search" : " shown"}
                      {q.trim() ? ` · ${rows.length} loaded` : null}
                    </span>
                    <span className="text-border">·</span>
                    <span className="tabular-nums">
                      {counts.active} active
                    </span>
                    <span className="text-muted-foreground/70">/</span>
                    <span className="tabular-nums">
                      {counts.inactive} inactive
                    </span>
                    <span className="text-border">·</span>
                    <span className="text-xs">Up to 500 per load</span>
                  </CardDescription>
                </div>
                <div className="flex w-full flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center xl:w-auto xl:justify-end">
                  <div className="relative min-w-[min(100%,16rem)] flex-1 sm:max-w-xs xl:flex-initial xl:min-w-[220px]">
                    <Search
                      className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                      aria-hidden
                    />
                    <Input
                      placeholder="Search name, ID, phone, site, role…"
                      value={q}
                      onChange={(e) => setQ(e.target.value)}
                      className="h-9 bg-background pl-9"
                      aria-label="Search staff"
                    />
                  </div>
                  <div className="flex w-full gap-2 sm:w-auto sm:shrink-0">
                    <Select
                      value={activeFilter}
                      onValueChange={(v) =>
                        setActiveFilter(v as "all" | "active" | "inactive")
                      }
                    >
                      <SelectTrigger className="h-9 w-full bg-background sm:w-[148px]">
                        <SelectValue placeholder="Status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All statuses</SelectItem>
                        <SelectItem value="active">Active only</SelectItem>
                        <SelectItem value="inactive">Inactive only</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      className="h-9 shrink-0"
                      onClick={() => void loadStaff()}
                    >
                      Refresh
                    </Button>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="max-h-[min(72vh,880px)] overflow-auto">
                <Table className="text-sm [&_td]:py-2 [&_th]:h-9 [&_th]:py-2 [&_th]:text-xs [&_th]:font-medium">
                  <TableHeader className="sticky top-0 z-10 border-b bg-muted/95 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-muted/80">
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="min-w-[10rem] pl-5">
                        Name
                      </TableHead>
                      <TableHead className="whitespace-nowrap">
                        Employee ID
                      </TableHead>
                      <TableHead className="hidden md:table-cell">
                        Role
                      </TableHead>
                      <TableHead className="hidden lg:table-cell min-w-[8rem]">
                        Site
                      </TableHead>
                      <TableHead className="hidden sm:table-cell">
                        Phone
                      </TableHead>
                      <TableHead className="w-[5.5rem]">Status</TableHead>
                      <TableHead className="w-[4.5rem] pr-5 text-right">
                        <span className="sr-only">Open</span>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={7}
                          className="h-28 text-center text-sm text-muted-foreground"
                        >
                          {rows.length === 0
                            ? "No staff in this filter. Try “All statuses” or refresh."
                            : "No rows match your search."}
                        </TableCell>
                      </TableRow>
                    ) : (
                      filtered.map((r) => (
                        <TableRow
                          key={r.id}
                          className="group border-border/60 hover:bg-muted/40"
                        >
                          <TableCell className="max-w-[14rem] pl-5 font-medium leading-tight">
                            <div className="truncate" title={r.full_name}>
                              {r.full_name}
                            </div>
                            <div className="mt-0.5 flex flex-wrap gap-x-2 text-[11px] text-muted-foreground md:hidden">
                              <span className="font-mono">{r.staff_type_code}</span>
                              {r.warehouse_code ? (
                                <span className="truncate">{r.warehouse_code}</span>
                              ) : null}
                            </div>
                          </TableCell>
                          <TableCell className="whitespace-nowrap font-mono text-xs text-muted-foreground">
                            {r.employee_code}
                          </TableCell>
                          <TableCell className="hidden md:table-cell">
                            <div className="max-w-[10rem] truncate text-muted-foreground" title={r.staff_type_name}>
                              <span className="font-mono text-xs text-foreground/80">
                                {r.staff_type_code}
                              </span>
                              <span className="ml-1.5 text-xs">
                                {r.staff_type_name}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="hidden lg:table-cell">
                            {r.warehouse_code ? (
                              <div className="max-w-[12rem] truncate text-muted-foreground" title={`${r.warehouse_code} — ${r.warehouse_name ?? ""}`}>
                                <span className="font-mono text-xs text-foreground/80">
                                  {r.warehouse_code}
                                </span>
                                {r.warehouse_name ? (
                                  <span className="ml-1.5 text-xs">
                                    {r.warehouse_name}
                                  </span>
                                ) : null}
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell className="hidden max-w-[9rem] truncate text-muted-foreground sm:table-cell text-xs">
                            {r.phone ?? "—"}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={r.is_active ? "secondary" : "outline"}
                              className="whitespace-nowrap px-1.5 py-0 text-[10px] font-medium uppercase tracking-wide"
                            >
                              {r.is_active ? "Active" : "Off"}
                            </Badge>
                          </TableCell>
                          <TableCell className="pr-5 text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 gap-0.5 px-2 text-muted-foreground hover:text-foreground"
                              asChild
                            >
                              <Link href={`/dashboard/staff/${r.id}`}>
                                <span className="hidden sm:inline">Edit</span>
                                <ChevronRight className="h-4 w-4 sm:ml-0.5" aria-hidden />
                              </Link>
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="add" className="mt-0 outline-none">
          <div className="mx-auto max-w-lg">
            <StaffAddPanel
              staffRefs={staffRefs}
              onStaffAdded={() => {
                loadStaff();
              }}
            />
          </div>
        </TabsContent>

        <TabsContent value="bulk" className="mt-0 outline-none">
          <StaffBulkImportPanel
            staffRefs={staffRefs}
            onImportComplete={() => {
              loadStaff();
            }}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default function StaffPage() {
  return (
    <Suspense
      fallback={
        <div className="text-sm text-muted-foreground">Loading…</div>
      }
    >
      <StaffHubContent />
    </Suspense>
  );
}

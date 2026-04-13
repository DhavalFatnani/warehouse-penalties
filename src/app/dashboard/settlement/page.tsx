"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger
} from "@/components/ui/collapsible";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, Download, RefreshCw } from "lucide-react";
import { useDashboardWarehouse } from "@/components/dashboard-warehouse-context";
import { cn } from "@/lib/utils";

type Row = Record<string, unknown>;

type PreviewGroup = {
  group_key: string;
  group_by: "staff" | "staff_type" | "warehouse";
  title: string;
  subtitle: string | null;
  staff_id: string | null;
  employee_code: string | null;
  warehouse_id: string | null;
  warehouse_name: string | null;
  staff_type_id: string | null;
  staff_type_name: string | null;
  total: number;
  count: number;
  distinct_staff_count: number;
  records: Row[];
};

type StaffTypeOpt = { id: string; code: string; display_name: string };
type StaffOpt = {
  id: string;
  employee_code: string | null;
  full_name: string;
};

export default function SettlementPage() {
  const { warehouseId, warehouses, userRole } = useDashboardWarehouse();
  const [from, setFrom] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().slice(0, 10);
  });
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [staffId, setStaffId] = useState("");
  const [staffTypeId, setStaffTypeId] = useState("");
  const [groupBy, setGroupBy] = useState<"staff" | "staff_type" | "warehouse">(
    "staff"
  );
  const [statusFilter, setStatusFilter] = useState<
    "created" | "settled" | "all"
  >("created");
  const [allTime, setAllTime] = useState(false);

  const [loading, setLoading] = useState(false);
  const [groups, setGroups] = useState<PreviewGroup[]>([]);
  const [recordIds, setRecordIds] = useState<string[]>([]);

  const [staffTypes, setStaffTypes] = useState<StaffTypeOpt[]>([]);
  const [staffList, setStaffList] = useState<StaffOpt[]>([]);

  useEffect(() => {
    void (async () => {
      try {
        const t = await fetch("/api/staff-types").then((r) => r.json());
        if (t.data) setStaffTypes(t.data);
      } catch {
        /* ignore */
      }
    })();
  }, []);

  useEffect(() => {
    let cancelled = false;
    setStaffId("");
    const p = new URLSearchParams();
    p.set("is_active", "true");
    if (warehouseId) p.set("warehouse_id", warehouseId);
    void fetch(`/api/staff?${p}`)
      .then((r) => r.json())
      .then((s) => {
        if (cancelled) return;
        if (s.data) setStaffList(s.data);
        else setStaffList([]);
      })
      .catch(() => {
        if (!cancelled) setStaffList([]);
      });
    return () => {
      cancelled = true;
    };
  }, [warehouseId]);

  const loadPreview = useCallback(async () => {
    setLoading(true);
    try {
      const p = new URLSearchParams({
        group_by: groupBy,
        status: statusFilter
      });
      if (!allTime) {
        p.set("incident_date_from", from);
        p.set("incident_date_to", to);
      } else {
        p.set("all_time", "1");
      }
      if (warehouseId) p.set("warehouse_id", warehouseId);
      if (staffId) p.set("staff_id", staffId);
      if (staffTypeId) p.set("staff_type_id", staffTypeId);

      const res = await fetch(`/api/settlement/preview?${p}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message ?? "Failed");
      setGroups(json.data.groups ?? []);
      setRecordIds(json.data.record_ids ?? []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }, [
    from,
    to,
    allTime,
    statusFilter,
    warehouseId,
    staffId,
    staffTypeId,
    groupBy
  ]);

  useEffect(() => {
    void loadPreview();
  }, [loadPreview]);

  const siteLabel = useMemo(() => {
    if (!warehouseId) {
      return userRole === "admin"
        ? "All warehouses"
        : "All sites you can access";
    }
    const w = warehouses.find((x) => x.id === warehouseId);
    return w ? `${w.code} — ${w.name}` : "Current site scope";
  }, [warehouseId, warehouses, userRole]);

  const selectedStaffTypeLabel = useMemo(() => {
    if (!staffTypeId) return null;
    return staffTypes.find((t) => t.id === staffTypeId)?.display_name ?? null;
  }, [staffTypeId, staffTypes]);

  const selectedStaffLabel = useMemo(() => {
    if (!staffId) return null;
    const s = staffList.find((x) => x.id === staffId);
    if (!s) return null;
    return s.employee_code
      ? `${s.full_name} (${s.employee_code})`
      : s.full_name;
  }, [staffId, staffList]);

  const dateRangeLabel = useMemo(() => {
    if (allTime) return "All incident dates";
    return `${formatDateLabel(from)} → ${formatDateLabel(to)}`;
  }, [allTime, from, to]);

  const statusLabel =
    statusFilter === "created"
      ? "Pending settlement"
      : statusFilter === "settled"
        ? "Settled only"
        : "All statuses";

  const groupByLabel =
    groupBy === "staff"
      ? "Staff"
      : groupBy === "staff_type"
        ? "Staff type"
        : "Warehouse";

  const metrics = useMemo(() => {
    let totalAmount = 0;
    let totalRecords = 0;
    const staffIds = new Set<string>();
    for (const g of groups) {
      totalAmount += g.total;
      totalRecords += g.count;
      for (const r of g.records) {
        const sid = String(r.staff_id ?? "");
        if (sid) staffIds.add(sid);
      }
    }
    return {
      totalAmount,
      totalRecords,
      groupCount: groups.length,
      distinctStaff: staffIds.size
    };
  }, [groups]);

  async function settleAll() {
    if (statusFilter !== "created") {
      toast.message("Switch to “Pending settlement” to mark records as settled");
      return;
    }
    if (!recordIds.length) {
      toast.message("Nothing to settle in this range");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/penalty-records/settle-batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ record_ids: recordIds })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message ?? "Failed");
      toast.success(`Settled ${json.data.settled_count} penalties`);
      await loadPreview();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  function downloadCsv() {
    const lines = [
      [
        "group",
        "staff",
        "employee_code",
        "staff_type",
        "warehouse",
        "penalty_code",
        "penalty",
        "status",
        "amount",
        "incident_date",
        "settled_at",
        "id"
      ].join(",")
    ];
    for (const g of groups) {
      for (const r of g.records) {
        lines.push(
          [
            JSON.stringify(g.title),
            JSON.stringify(String(r.staff_full_name ?? "")),
            JSON.stringify(String(r.employee_code ?? "")),
            JSON.stringify(String(r.staff_type_name ?? "")),
            JSON.stringify(String(r.warehouse_name ?? "")),
            JSON.stringify(String(r.penalty_code ?? "")),
            JSON.stringify(String(r.penalty_title ?? "")),
            JSON.stringify(String(r.status ?? "")),
            String(r.computed_amount ?? ""),
            String(r.incident_date ?? ""),
            JSON.stringify(String(r.settled_at ?? "")),
            String(r.id ?? "")
          ].join(",")
        );
      }
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    const url = URL.createObjectURL(blob);
    a.href = url;
    const datePart = allTime ? "all-time" : `${from}_${to}`;
    const statusPart =
      statusFilter === "created"
        ? "pending"
        : statusFilter === "settled"
          ? "settled"
          : "all-status";
    a.download = `settlement-${statusPart}-${datePart}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const groupSectionTitle =
    groupBy === "staff"
      ? "By staff"
      : groupBy === "staff_type"
        ? "By staff type"
        : "By warehouse";

  return (
    <div className="mx-auto w-full max-w-[min(100%,72rem)] space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settlement</h1>
        <p className="text-sm text-muted-foreground">
          Match payroll to penalties: filter by status and incident dates, then
          review totals. Site scope comes from the sidebar; CSV export uses the
          same filters as the preview (up to 5,000 rows). Bulk settle applies
          only while status is pending.
        </p>
      </div>

      <Card className="overflow-hidden shadow-sm">
        <CardHeader className="border-b bg-muted/30 px-3 py-2 sm:px-4">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <CardTitle className="text-sm font-semibold">
                Filters &amp; preview
              </CardTitle>
              <CardDescription className="text-[11px] leading-snug">
                Preview updates as you change filters. Site:{" "}
                <span className="font-medium text-foreground">{siteLabel}</span>
              </CardDescription>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={loading}
              onClick={() => void loadPreview()}
              className="h-8 shrink-0 gap-1 px-2 text-xs"
            >
              <RefreshCw
                className={cn("h-3 w-3", loading && "animate-spin")}
                aria-hidden
              />
              {loading ? "…" : "Refresh"}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-2 p-3 sm:p-4">
          {/* Dates + all-time */}
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end">
            <div className="grid grid-cols-2 gap-2 sm:max-w-[17rem]">
              <div className="space-y-0.5">
                <Label
                  htmlFor="settle-from"
                  className="text-[10px] uppercase tracking-wide text-muted-foreground"
                >
                  From
                </Label>
                <Input
                  id="settle-from"
                  type="date"
                  value={from}
                  disabled={allTime}
                  onChange={(e) => setFrom(e.target.value)}
                  className="h-8 bg-background text-xs"
                />
              </div>
              <div className="space-y-0.5">
                <Label
                  htmlFor="settle-to"
                  className="text-[10px] uppercase tracking-wide text-muted-foreground"
                >
                  To
                </Label>
                <Input
                  id="settle-to"
                  type="date"
                  value={to}
                  disabled={allTime}
                  onChange={(e) => setTo(e.target.value)}
                  className="h-8 bg-background text-xs"
                />
              </div>
            </div>
            <label
              className={cn(
                "flex cursor-pointer items-center gap-2 rounded-md border px-2.5 py-1.5 text-xs sm:ml-0",
                allTime
                  ? "border-primary/40 bg-primary/[0.06]"
                  : "border-transparent bg-muted/40"
              )}
            >
              <Checkbox
                id="all-time"
                checked={allTime}
                onCheckedChange={(c) => setAllTime(c === true)}
                className="h-3.5 w-3.5"
              />
              <span className="font-medium leading-none">All time</span>
            </label>
          </div>

          {/* Filters row */}
          <div className="flex flex-col gap-2 lg:flex-row lg:flex-wrap lg:items-end">
            <div className="grid flex-1 grid-cols-2 gap-2 min-[520px]:grid-cols-4">
              <div className="space-y-0.5">
                <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  Status
                </Label>
                <Select
                  value={statusFilter}
                  onValueChange={(v) =>
                    setStatusFilter(v as "created" | "settled" | "all")
                  }
                >
                  <SelectTrigger className="h-8 bg-background text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="created">Pending settlement</SelectItem>
                    <SelectItem value="settled">Settled</SelectItem>
                    <SelectItem value="all">All statuses</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-0.5">
                <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  Staff type
                </Label>
                <Select
                  value={staffTypeId || "all"}
                  onValueChange={(v) => setStaffTypeId(v === "all" ? "" : v)}
                >
                  <SelectTrigger className="h-8 bg-background text-xs">
                    <SelectValue placeholder="All types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All types</SelectItem>
                    {staffTypes.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.display_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2 space-y-0.5 min-[520px]:col-span-2">
                <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  Staff
                </Label>
                <Select
                  value={staffId || "all"}
                  onValueChange={(v) => setStaffId(v === "all" ? "" : v)}
                >
                  <SelectTrigger className="h-8 bg-background text-xs">
                    <SelectValue placeholder="All staff" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All staff</SelectItem>
                    {staffList.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.full_name}
                        {s.employee_code ? ` (${s.employee_code})` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2 space-y-0.5 min-[520px]:col-span-1">
                <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  Group by
                </Label>
                <Select
                  value={groupBy}
                  onValueChange={(v) =>
                    setGroupBy(v as "staff" | "staff_type" | "warehouse")
                  }
                >
                  <SelectTrigger className="h-8 bg-background text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="staff">Staff</SelectItem>
                    <SelectItem value="staff_type">Staff type</SelectItem>
                    <SelectItem value="warehouse">Warehouse</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Compact metrics */}
          <div
            className={cn(
              "flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md border border-border/60 bg-muted/30 px-2.5 py-1.5 text-[11px]",
              loading && "opacity-60"
            )}
          >
            <span className="text-muted-foreground">
              {loading ? "Updating…" : "Preview"}
            </span>
            <span className="hidden h-3 w-px bg-border sm:block" aria-hidden />
            <span className="text-muted-foreground">Rows</span>
            <span className="font-semibold tabular-nums text-foreground">
              {metrics.totalRecords}
            </span>
            <span className="text-border">·</span>
            <span className="text-muted-foreground">Total</span>
            <span className="font-semibold tabular-nums text-foreground">
              {formatMoney(metrics.totalAmount)}
            </span>
            <span className="text-border">·</span>
            <span className="text-muted-foreground">Groups</span>
            <span className="font-semibold tabular-nums text-foreground">
              {metrics.groupCount}
            </span>
            <span className="text-border">·</span>
            <span className="text-muted-foreground">Staff</span>
            <span className="font-semibold tabular-nums text-foreground">
              {metrics.distinctStaff}
            </span>
          </div>

          {statusFilter === "created" && recordIds.length > 0 ? (
            <p className="text-[11px] text-emerald-700 dark:text-emerald-400/90">
              <span className="font-semibold tabular-nums">{recordIds.length}</span>{" "}
              pending row{recordIds.length === 1 ? "" : "s"} will be settled in bulk.
            </p>
          ) : statusFilter === "created" && !loading && metrics.totalRecords === 0 ? (
            <p className="text-[11px] text-muted-foreground">
              No pending rows — widen dates or relax filters.
            </p>
          ) : null}

          <div className="flex flex-wrap gap-1">
            <Badge variant="secondary" className="h-5 px-1.5 text-[10px] font-normal">
              {statusLabel}
            </Badge>
            <Badge variant="outline" className="h-5 max-w-[14rem] truncate px-1.5 text-[10px] font-normal">
              {dateRangeLabel}
            </Badge>
            <Badge variant="outline" className="h-5 max-w-[12rem] truncate px-1.5 text-[10px] font-normal">
              {siteLabel}
            </Badge>
            <Badge variant="outline" className="h-5 px-1.5 text-[10px] font-normal">
              {groupByLabel}
            </Badge>
            {selectedStaffTypeLabel ? (
              <Badge variant="outline" className="h-5 max-w-[10rem] truncate px-1.5 text-[10px] font-normal">
                {selectedStaffTypeLabel}
              </Badge>
            ) : null}
            {selectedStaffLabel ? (
              <Badge variant="outline" className="h-5 max-w-[12rem] truncate px-1.5 text-[10px] font-normal">
                {selectedStaffLabel}
              </Badge>
            ) : null}
          </div>

          <Separator className="my-1" />

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-[11px] text-muted-foreground">
              CSV matches preview. Settle only while status is pending.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                className="h-8 text-xs"
                onClick={() => void settleAll()}
                disabled={
                  loading ||
                  !recordIds.length ||
                  statusFilter !== "created"
                }
              >
                Mark all settled
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="h-8 text-xs"
                onClick={downloadCsv}
              >
                <Download className="mr-1.5 h-3.5 w-3.5" />
                Export CSV
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-sm">
        <CardHeader className="border-b bg-muted/20 px-4 py-3">
          <CardTitle className="text-base">{groupSectionTitle}</CardTitle>
          <CardDescription className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="tabular-nums font-medium text-foreground">
              {metrics.groupCount}
            </span>
            <span>
              {groupBy === "staff"
                ? "staff buckets"
                : groupBy === "staff_type"
                  ? "type buckets"
                  : "warehouse buckets"}
            </span>
            <span className="text-border">·</span>
            <span className="tabular-nums">{metrics.totalRecords}</span>
            <span>penalties</span>
            <span className="text-border">·</span>
            <span>{formatMoney(metrics.totalAmount)}</span>
            <span>combined</span>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {groups.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No penalties match these filters.
            </p>
          ) : (
            groups.map((g) => (
              <Collapsible key={g.group_key} className="rounded-lg border">
                <CollapsibleTrigger className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-muted/50">
                  <div>
                    <div className="font-medium">{g.title}</div>
                    {g.subtitle ? (
                      <div className="text-xs text-muted-foreground">
                        {g.subtitle}
                      </div>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="tabular-nums font-semibold">
                      {formatMoney(g.total)}
                    </span>
                    <ChevronDown className="h-4 w-4" />
                  </div>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Staff</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Penalty</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {g.records.map((r) => (
                        <TableRow key={String(r.id)}>
                          <TableCell>
                            {String(r.staff_full_name ?? "")}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {String(r.staff_type_name ?? "")}
                          </TableCell>
                          <TableCell>{String(r.penalty_title ?? "")}</TableCell>
                          <TableCell>{String(r.incident_date ?? "")}</TableCell>
                          <TableCell className="text-right tabular-nums">
                            {formatMoney(Number(r.computed_amount ?? 0))}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CollapsibleContent>
              </Collapsible>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function formatMoney(n: number) {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0
  }).format(n);
}

function formatDateLabel(isoDate: string) {
  const parts = isoDate.split("-");
  if (parts.length !== 3) return isoDate;
  const [year, month, day] = parts;
  const monthIdx = Number(month) - 1;
  const dayNum = Number(day);
  if (!Number.isInteger(monthIdx) || monthIdx < 0 || monthIdx > 11) return isoDate;
  if (!Number.isInteger(dayNum)) return isoDate;
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec"
  ];
  return `${months[monthIdx]} ${dayNum}, ${year}`;
}

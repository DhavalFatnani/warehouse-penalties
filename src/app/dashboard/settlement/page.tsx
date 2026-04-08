"use client";

import { useCallback, useEffect, useState } from "react";
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
import { CalendarRange, ChevronDown, Download, Layers, ListFilter } from "lucide-react";

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

type WarehouseOpt = { id: string; code: string; name: string };
type StaffTypeOpt = { id: string; code: string; display_name: string };
type StaffOpt = {
  id: string;
  employee_code: string | null;
  full_name: string;
};

export default function SettlementPage() {
  const [from, setFrom] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().slice(0, 10);
  });
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [warehouseId, setWarehouseId] = useState("");
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

  const [warehouses, setWarehouses] = useState<WarehouseOpt[]>([]);
  const [staffTypes, setStaffTypes] = useState<StaffTypeOpt[]>([]);
  const [staffList, setStaffList] = useState<StaffOpt[]>([]);

  useEffect(() => {
    void (async () => {
      try {
        const [w, t, s] = await Promise.all([
          fetch("/api/warehouses").then((r) => r.json()),
          fetch("/api/staff-types").then((r) => r.json()),
          fetch("/api/staff?is_active=true").then((r) => r.json())
        ]);
        if (w.data) setWarehouses(w.data);
        if (t.data) setStaffTypes(t.data);
        if (s.data) setStaffList(s.data);
      } catch {
        /* ignore */
      }
    })();
  }, []);

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
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settlement</h1>
        <p className="text-sm text-muted-foreground">
          Preview penalties by <span className="font-medium">status</span> and
          incident date (or all time), grouped for payroll.{" "}
          <span className="font-medium">Export CSV</span> matches the current
          filters. Pending-only rows can be marked settled in bulk.
        </p>
      </div>

      <Card className="overflow-hidden">
        <CardHeader className="border-b bg-muted/40 pb-4">
          <CardTitle className="text-base">Settlement filters</CardTitle>
          <CardDescription className="max-w-2xl">
            Tune the preview and CSV export (same query, up to 5,000 rows).
            Bulk settle is only available for pending records.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-0 p-0">
          {/* Time range */}
          <div className="space-y-4 p-5 sm:p-6">
            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
              <CalendarRange className="h-4 w-4 text-muted-foreground" aria-hidden />
              Incident date
            </div>
            <div className="flex flex-col gap-4 lg:flex-row lg:items-stretch lg:justify-between">
              <div className="grid grid-cols-2 gap-3 sm:max-w-md">
                <div className="space-y-1.5">
                  <Label htmlFor="settle-from" className="text-xs text-muted-foreground">
                    From
                  </Label>
                  <Input
                    id="settle-from"
                    type="date"
                    value={from}
                    disabled={allTime}
                    onChange={(e) => setFrom(e.target.value)}
                    className="bg-background"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="settle-to" className="text-xs text-muted-foreground">
                    To
                  </Label>
                  <Input
                    id="settle-to"
                    type="date"
                    value={to}
                    disabled={allTime}
                    onChange={(e) => setTo(e.target.value)}
                    className="bg-background"
                  />
                </div>
              </div>
              <div
                className={`flex flex-1 items-center rounded-lg border px-4 py-3 lg:max-w-sm ${
                  allTime
                    ? "border-primary/30 bg-primary/5"
                    : "border-border bg-muted/30"
                }`}
              >
                <div className="flex items-start gap-3">
                  <Checkbox
                    id="all-time"
                    checked={allTime}
                    onCheckedChange={(c) => setAllTime(c === true)}
                    className="mt-0.5"
                  />
                  <div className="space-y-0.5">
                    <Label htmlFor="all-time" className="cursor-pointer font-medium leading-none">
                      All time
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Ignore From / To and include every incident date.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <Separator />

          {/* Scope */}
          <div className="space-y-4 p-5 sm:p-6">
            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
              <ListFilter className="h-4 w-4 text-muted-foreground" aria-hidden />
              Record scope
            </div>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Status</Label>
                <Select
                  value={statusFilter}
                  onValueChange={(v) =>
                    setStatusFilter(v as "created" | "settled" | "all")
                  }
                >
                  <SelectTrigger className="bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="created">Pending settlement</SelectItem>
                    <SelectItem value="settled">Settled</SelectItem>
                    <SelectItem value="all">All statuses</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Warehouse</Label>
                <Select
                  value={warehouseId || "all"}
                  onValueChange={(v) => setWarehouseId(v === "all" ? "" : v)}
                >
                  <SelectTrigger className="bg-background">
                    <SelectValue placeholder="All warehouses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All warehouses</SelectItem>
                    {warehouses.map((w) => (
                      <SelectItem key={w.id} value={w.id}>
                        {w.code} — {w.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Staff type</Label>
                <Select
                  value={staffTypeId || "all"}
                  onValueChange={(v) => setStaffTypeId(v === "all" ? "" : v)}
                >
                  <SelectTrigger className="bg-background">
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
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Staff</Label>
                <Select
                  value={staffId || "all"}
                  onValueChange={(v) => setStaffId(v === "all" ? "" : v)}
                >
                  <SelectTrigger className="bg-background">
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
            </div>
          </div>

          <Separator />

          {/* Grouping */}
          <div className="space-y-4 p-5 sm:px-6 sm:pb-6 sm:pt-4">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <Layers className="h-4 w-4 text-muted-foreground" aria-hidden />
                  Preview grouping
                </div>
                <p className="text-xs text-muted-foreground">
                  How rows are rolled up in the list below.
                </p>
              </div>
              <div className="w-full space-y-1.5 sm:w-56">
                <Label className="text-xs text-muted-foreground">Group by</Label>
                <Select
                  value={groupBy}
                  onValueChange={(v) =>
                    setGroupBy(v as "staff" | "staff_type" | "warehouse")
                  }
                >
                  <SelectTrigger className="bg-background">
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

          <Separator />

          {/* Actions */}
          <div className="flex flex-col gap-3 bg-muted/20 p-5 sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:py-4">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={loading}
              onClick={() => void loadPreview()}
              className="w-full sm:w-auto"
            >
              {loading ? "Loading…" : "Refresh preview"}
            </Button>
            <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
              <Button
                type="button"
                onClick={() => void settleAll()}
                disabled={
                  loading ||
                  !recordIds.length ||
                  statusFilter !== "created"
                }
                className="w-full sm:w-auto"
              >
                Mark all as settled
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="default"
                className="w-full sm:w-auto"
                onClick={downloadCsv}
              >
                <Download className="mr-2 h-4 w-4" />
                Export CSV
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{groupSectionTitle}</CardTitle>
          <CardDescription>
            {groups.length}{" "}
            {groupBy === "staff"
              ? "staff with open penalties"
              : groupBy === "staff_type"
                ? "groups"
                : "warehouses"}{" "}
            in current filters
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

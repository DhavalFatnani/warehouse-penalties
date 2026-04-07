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
import { ChevronDown, Download } from "lucide-react";

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
        incident_date_from: from,
        incident_date_to: to,
        group_by: groupBy
      });
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
  }, [from, to, warehouseId, staffId, staffTypeId, groupBy]);

  useEffect(() => {
    void loadPreview();
  }, [loadPreview]);

  async function settleAll() {
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
        "penalty",
        "amount",
        "date",
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
            JSON.stringify(String(r.penalty_title ?? "")),
            String(r.computed_amount ?? ""),
            String(r.incident_date ?? ""),
            String(r.id ?? "")
          ].join(",")
        );
      }
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `settlement-${from}-${to}.csv`;
    a.click();
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
          Open penalties (<span className="font-medium">created</span>) in the
          date range, grouped for payroll. Marking settled excludes them from
          the next cycle.
        </p>
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <CardTitle className="text-base">Cycle window & filters</CardTitle>
            <CardDescription>
              Incident date in range, optional warehouse / staff / staff type
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-3">
            <div className="space-y-1">
              <Label>From</Label>
              <Input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label>To</Label>
              <Input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
              />
            </div>
            <Button variant="secondary" onClick={() => void loadPreview()}>
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1">
              <Label>Warehouse</Label>
              <Select
                value={warehouseId || "all"}
                onValueChange={(v) => setWarehouseId(v === "all" ? "" : v)}
              >
                <SelectTrigger>
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
            <div className="space-y-1">
              <Label>Staff type</Label>
              <Select
                value={staffTypeId || "all"}
                onValueChange={(v) => setStaffTypeId(v === "all" ? "" : v)}
              >
                <SelectTrigger>
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
            <div className="space-y-1">
              <Label>Staff</Label>
              <Select
                value={staffId || "all"}
                onValueChange={(v) => setStaffId(v === "all" ? "" : v)}
              >
                <SelectTrigger>
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
            <div className="space-y-1">
              <Label>Group by</Label>
              <Select
                value={groupBy}
                onValueChange={(v) =>
                  setGroupBy(v as "staff" | "staff_type" | "warehouse")
                }
              >
                <SelectTrigger>
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
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => void settleAll()}
              disabled={loading || !recordIds.length}
            >
              Mark all as settled
            </Button>
            <Button variant="outline" size="sm" onClick={downloadCsv}>
              <Download className="mr-2 h-4 w-4" />
              Export CSV
            </Button>
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
              No open penalties in range.
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

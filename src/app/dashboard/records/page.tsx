"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { StaffSearchCombobox } from "@/components/staff-search-combobox";
import { useDashboardWarehouse } from "@/components/dashboard-warehouse-context";
import {
  CalendarRange,
  CheckCircle2,
  ClipboardList,
  ExternalLink,
  FileText,
  Loader2,
  RefreshCw,
  Search
} from "lucide-react";

type Row = Record<string, unknown>;

type StaffOpt = { id: string; full_name: string; employee_code: string };

export default function RecordsPage() {
  const { warehouseId, hrefWithWarehouse } = useDashboardWarehouse();
  const [rows, setRows] = useState<Row[]>([]);
  const [status, setStatus] = useState<string>("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [staffFilterId, setStaffFilterId] = useState("");
  const [staffOptions, setStaffOptions] = useState<StaffOpt[]>([]);
  const [loading, setLoading] = useState(false);
  const [settlingId, setSettlingId] = useState<string | null>(null);
  const [settleSubmitting, setSettleSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setStaffFilterId("");
    const qs = new URLSearchParams();
    if (warehouseId) qs.set("warehouse_id", warehouseId);
    const suffix = qs.toString() ? `?${qs.toString()}` : "";
    void fetch(`/api/staff${suffix}`)
      .then((r) => r.json())
      .then((j) => {
        if (cancelled) return;
        const list = (j.data ?? []) as Record<string, unknown>[];
        setStaffOptions(
          list.map((s) => ({
            id: String(s.id),
            full_name: String(s.full_name ?? ""),
            employee_code: String(s.employee_code ?? "")
          }))
        );
      })
      .catch(() => {
        if (!cancelled) setStaffOptions([]);
      });
    return () => {
      cancelled = true;
    };
  }, [warehouseId]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const p = new URLSearchParams();
      if (status !== "all") p.set("status", status);
      if (from) p.set("incident_date_from", from);
      if (to) p.set("incident_date_to", to);
      if (warehouseId) p.set("warehouse_id", warehouseId);
      if (staffFilterId) p.set("staff_id", staffFilterId);
      const res = await fetch(`/api/penalty-records?${p}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message ?? "Failed");
      setRows(json.data ?? []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }, [status, from, to, warehouseId, staffFilterId]);

  useEffect(() => {
    void load();
  }, [load]);

  const stats = useMemo(() => {
    const open = rows.filter((r) => r.status === "created").length;
    const settled = rows.filter((r) => r.status === "settled").length;
    let openAmount = 0;
    let settledAmount = 0;
    for (const r of rows) {
      const amt = Number(r.computed_amount ?? 0);
      if (r.status === "created") openAmount += amt;
      if (r.status === "settled") settledAmount += amt;
    }
    return {
      total: rows.length,
      open,
      settled,
      openAmount,
      settledAmount
    };
  }, [rows]);

  function setPresetThisMonth() {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    setFrom(start.toISOString().slice(0, 10));
    setTo(now.toISOString().slice(0, 10));
  }

  function setPresetLast30() {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 30);
    setFrom(start.toISOString().slice(0, 10));
    setTo(end.toISOString().slice(0, 10));
  }

  function clearDates() {
    setFrom("");
    setTo("");
  }

  async function settle(id: string) {
    setSettleSubmitting(true);
    try {
      const res = await fetch(`/api/penalty-records/${id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "settled" })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message ?? "Failed");
      toast.success("Marked settled");
      setSettlingId(null);
      void load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    } finally {
      setSettleSubmitting(false);
    }
  }

  const rowPendingSettle = settlingId
    ? rows.find((r) => String(r.id) === settlingId)
    : null;

  return (
    <div className="mx-auto w-full max-w-[min(100%,96rem)] space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <ClipboardList className="h-4 w-4" aria-hidden />
            </div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Penalty records
            </h1>
          </div>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Records respect{" "}
            <span className="font-medium text-foreground">Site scope</span> in
            the sidebar. Filter by person, incident dates, and status, then mark
            rows settled. For bulk cycles, use{" "}
            <Link
              href={hrefWithWarehouse("/dashboard/settlement")}
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              Settlement
            </Link>
            .
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Button asChild variant="secondary" size="sm">
            <Link href={hrefWithWarehouse("/dashboard/apply")}>
              Apply penalty
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href={hrefWithWarehouse("/dashboard/settlement")}>
              Bulk settlement
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="shadow-sm">
          <CardHeader className="pb-2 pt-4">
            <CardDescription className="text-xs font-medium uppercase tracking-wide">
              In view
            </CardDescription>
            <CardTitle className="text-2xl font-semibold tabular-nums">
              {loading ? "—" : stats.total}
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-4 pt-0 text-xs text-muted-foreground">
            Rows matching your filters (max 1000)
          </CardContent>
        </Card>
        <Card className="border-amber-500/25 bg-amber-500/[0.04] shadow-sm">
          <CardHeader className="pb-2 pt-4">
            <CardDescription className="text-xs font-medium uppercase tracking-wide text-amber-900/80 dark:text-amber-200/90">
              Open (created)
            </CardDescription>
            <CardTitle className="text-2xl font-semibold tabular-nums text-amber-950 dark:text-amber-50">
              {loading ? "—" : stats.open}
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-4 pt-0 text-xs text-muted-foreground">
            {loading ? "—" : formatMoney(stats.openAmount)} pending
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardHeader className="pb-2 pt-4">
            <CardDescription className="text-xs font-medium uppercase tracking-wide">
              Settled
            </CardDescription>
            <CardTitle className="text-2xl font-semibold tabular-nums">
              {loading ? "—" : stats.settled}
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-4 pt-0 text-xs text-muted-foreground">
            {loading ? "—" : formatMoney(stats.settledAmount)} in view
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardHeader className="pb-2 pt-4">
            <CardDescription className="text-xs font-medium uppercase tracking-wide">
              Refresh
            </CardDescription>
            <CardTitle className="text-base font-medium leading-snug">
              Sync latest
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-4 pt-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full sm:w-auto"
              disabled={loading}
              onClick={() => void load()}
            >
              {loading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <RefreshCw className="mr-2 h-4 w-4" aria-hidden />
              )}
              Reload
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card className="overflow-hidden shadow-sm">
        <CardHeader className="border-b bg-muted/30 pb-4">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-lg">Filters</CardTitle>
              <CardDescription>
                Narrow by person, incident dates, and status
              </CardDescription>
            </div>
            <div className="flex flex-wrap gap-2 pt-1 sm:pt-0">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="h-8"
                onClick={setPresetThisMonth}
              >
                <CalendarRange className="mr-1.5 h-3.5 w-3.5" aria-hidden />
                This month
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="h-8"
                onClick={setPresetLast30}
              >
                Last 30 days
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8"
                onClick={clearDates}
              >
                Clear dates
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="grid gap-5 pt-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          <div className="space-y-2 sm:col-span-2 xl:col-span-2">
            <Label htmlFor="rec-staff">Staff</Label>
            <StaffSearchCombobox
              id="rec-staff"
              staff={staffOptions}
              value={staffFilterId}
              onValueChange={setStaffFilterId}
              placeholder="Optional — search by name or employee ID"
              emptyText={
                staffOptions.length === 0
                  ? "No staff loaded for your access."
                  : "No staff match your search."
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="rec-status">Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger id="rec-status" className="bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="created">Created (open)</SelectItem>
                <SelectItem value="settled">Settled</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="rec-from">From</Label>
            <Input
              id="rec-from"
              type="date"
              className="bg-background"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="rec-to">To</Label>
            <Input
              id="rec-to"
              type="date"
              className="bg-background"
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <Card className="overflow-hidden shadow-sm">
        <CardHeader className="border-b bg-muted/20 py-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-lg">Results</CardTitle>
              <CardDescription className="flex items-center gap-1.5">
                <Search className="h-3.5 w-3.5" aria-hidden />
                {loading
                  ? "Loading…"
                  : `${stats.total} record${stats.total === 1 ? "" : "s"}`}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="max-h-[min(72vh,880px)] overflow-auto">
            <Table className="text-sm [&_td]:py-2.5 [&_th]:h-10 [&_th]:py-2 [&_th]:text-xs [&_th]:font-medium">
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="sticky top-0 z-10 min-w-[11rem] border-b bg-muted/95 pl-5 backdrop-blur supports-[backdrop-filter]:bg-muted/80">
                    Staff
                  </TableHead>
                  <TableHead className="sticky top-0 z-10 hidden border-b bg-muted/95 backdrop-blur md:table-cell supports-[backdrop-filter]:bg-muted/80 lg:min-w-[8rem]">
                    Site
                  </TableHead>
                  <TableHead className="sticky top-0 z-10 min-w-[10rem] border-b bg-muted/95 backdrop-blur supports-[backdrop-filter]:bg-muted/80">
                    Penalty
                  </TableHead>
                  <TableHead className="sticky top-0 z-10 border-b bg-muted/95 text-right tabular-nums backdrop-blur supports-[backdrop-filter]:bg-muted/80">
                    Amount
                  </TableHead>
                  <TableHead className="sticky top-0 z-10 border-b bg-muted/95 backdrop-blur supports-[backdrop-filter]:bg-muted/80">
                    Status
                  </TableHead>
                  <TableHead className="sticky top-0 z-10 whitespace-nowrap border-b bg-muted/95 backdrop-blur supports-[backdrop-filter]:bg-muted/80">
                    Incident
                  </TableHead>
                  <TableHead className="sticky top-0 z-10 hidden border-b bg-muted/95 backdrop-blur sm:table-cell supports-[backdrop-filter]:bg-muted/80">
                    Settled
                  </TableHead>
                  <TableHead className="sticky top-0 z-10 border-b bg-muted/95 pr-5 text-right backdrop-blur supports-[backdrop-filter]:bg-muted/80">
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading && rows.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={8}
                      className="h-48 text-center align-middle"
                    >
                      <div className="flex flex-col items-center justify-center gap-2">
                        <Loader2
                          className="h-8 w-8 animate-spin text-muted-foreground"
                          aria-hidden
                        />
                        <p className="text-sm text-muted-foreground">
                          Loading records…
                        </p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : rows.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={8}
                      className="h-40 px-6 text-center align-middle"
                    >
                      <div className="mx-auto flex max-w-md flex-col items-center gap-3">
                        <div className="rounded-full bg-muted p-3 text-muted-foreground">
                          <ClipboardList className="h-6 w-6" aria-hidden />
                        </div>
                        <div className="space-y-1">
                          <p className="font-medium text-foreground">
                            No penalty records match
                          </p>
                          <p className="text-sm text-muted-foreground">
                            Widen your date range, clear filters, or record a new
                            penalty.
                          </p>
                        </div>
                        <Button asChild size="sm">
                          <Link href={hrefWithWarehouse("/dashboard/apply")}>
                            Apply penalty
                          </Link>
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((row) => (
                    <TableRow
                      key={String(row.id)}
                      className="group border-border/60 hover:bg-muted/40"
                    >
                      <TableCell className="pl-5 align-top">
                        <div className="font-medium leading-tight">
                          {String(row.staff_full_name ?? "—")}
                        </div>
                        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11px] text-muted-foreground">
                          <span className="font-mono">
                            {String(row.employee_code ?? "—")}
                          </span>
                          {row.staff_type_code ? (
                            <>
                              <span className="text-border">·</span>
                              <span>
                                {String(row.staff_type_code)}{" "}
                                <span className="hidden sm:inline">
                                  {String(row.staff_type_name ?? "")}
                                </span>
                              </span>
                            </>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell className="hidden align-top text-muted-foreground md:table-cell">
                        {row.warehouse_code ? (
                          <div className="max-w-[10rem]">
                            <div className="font-mono text-xs text-foreground/90">
                              {String(row.warehouse_code)}
                            </div>
                            <div className="truncate text-xs">
                              {String(row.warehouse_name ?? "")}
                            </div>
                          </div>
                        ) : (
                          <span className="text-xs">—</span>
                        )}
                      </TableCell>
                      <TableCell className="align-top">
                        <div className="flex flex-col gap-0.5">
                          {row.penalty_code ? (
                            <span className="font-mono text-xs font-medium text-foreground">
                              {String(row.penalty_code)}
                            </span>
                          ) : null}
                          <span className="leading-snug text-muted-foreground">
                            {String(row.penalty_title ?? "—")}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="align-top text-right tabular-nums font-medium">
                        {formatMoney(Number(row.computed_amount ?? 0))}
                      </TableCell>
                      <TableCell className="align-top">
                        <StatusBadge status={String(row.status ?? "")} />
                      </TableCell>
                      <TableCell className="align-top tabular-nums text-muted-foreground">
                        {formatIncidentDate(String(row.incident_date ?? ""))}
                      </TableCell>
                      <TableCell className="hidden align-top text-xs text-muted-foreground sm:table-cell">
                        {row.settled_at
                          ? formatShortDateTime(String(row.settled_at))
                          : "—"}
                      </TableCell>
                      <TableCell className="pr-5 text-right align-top">
                        <div className="flex flex-col items-end gap-1.5 sm:flex-row sm:justify-end sm:gap-2">
                          {row.proof_url ? (
                            <Button variant="outline" size="sm" asChild>
                              <a
                                href={String(row.proof_url)}
                                target="_blank"
                                rel="noreferrer"
                                className="gap-1"
                              >
                                <FileText className="h-3.5 w-3.5" aria-hidden />
                                <span className="hidden sm:inline">Proof</span>
                                <ExternalLink className="h-3 w-3 opacity-60 sm:hidden" />
                              </a>
                            </Button>
                          ) : null}
                          {row.status === "created" ? (
                            <Button
                              variant="default"
                              size="sm"
                              className="gap-1 bg-emerald-600 hover:bg-emerald-600/90 dark:bg-emerald-700 dark:hover:bg-emerald-700/90"
                              onClick={() => setSettlingId(String(row.id))}
                            >
                              <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
                              Settle
                            </Button>
                          ) : null}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog
        open={settlingId !== null}
        onOpenChange={(open) => {
          if (!open && !settleSubmitting) setSettlingId(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark this penalty settled?</DialogTitle>
            <DialogDescription>
              This flags the row as processed for payroll. You can still see it
              when filtering by settled status.
            </DialogDescription>
          </DialogHeader>
          {rowPendingSettle ? (
            <div className="rounded-lg border bg-muted/40 px-3 py-2 text-sm">
              <p className="font-medium">
                {String(rowPendingSettle.staff_full_name ?? "")}
              </p>
              <p className="text-xs text-muted-foreground">
                {String(rowPendingSettle.penalty_title ?? "")} ·{" "}
                {formatMoney(
                  Number(rowPendingSettle.computed_amount ?? 0)
                )}{" "}
                · {String(rowPendingSettle.incident_date ?? "")}
              </p>
            </div>
          ) : null}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              disabled={settleSubmitting}
              onClick={() => setSettlingId(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={settleSubmitting || !settlingId}
              onClick={() => settlingId && void settle(settlingId)}
            >
              {settleSubmitting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
              ) : null}
              Confirm settle
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === "created") {
    return (
      <Badge
        variant="secondary"
        className="border border-amber-500/35 bg-amber-500/12 font-medium text-amber-950 dark:text-amber-100"
      >
        Open
      </Badge>
    );
  }
  if (status === "settled") {
    return (
      <Badge
        variant="outline"
        className="border-emerald-500/40 bg-emerald-500/10 font-medium text-emerald-900 dark:text-emerald-100"
      >
        Settled
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="font-normal capitalize">
      {status || "—"}
    </Badge>
  );
}

function formatMoney(n: number) {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0
  }).format(n);
}

function formatIncidentDate(isoDate: string) {
  if (!isoDate) return "—";
  try {
    const d = new Date(isoDate + "T12:00:00");
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium"
    }).format(d);
  } catch {
    return isoDate;
  }
}

function formatShortDateTime(iso: string) {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "short",
      timeStyle: "short"
    }).format(d);
  } catch {
    return iso;
  }
}

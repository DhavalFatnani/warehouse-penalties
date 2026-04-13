"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription
} from "@/components/ui/dialog";

type Actor = {
  id: string;
  full_name: string;
  email: string;
};

type ActivityRow = {
  id: string;
  entity_type: string;
  entity_id: string;
  action: string;
  changed_at: string;
  changed_by_user_id: string | null;
  old_values: unknown;
  new_values: unknown;
  actor: Actor | null;
};

type UserRow = {
  id: string;
  full_name: string;
  email: string;
};

const PAGE_SIZE = 25;
const MAX_DIFF_ROWS = 120;

type ChangedField = {
  path: string;
  oldValue: unknown;
  newValue: unknown;
  kind: "added" | "removed" | "changed";
};

function formatDateTime(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(d);
}

function looksLikeIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}T/.test(value)) return false;
  const d = new Date(value);
  return !Number.isNaN(d.getTime());
}

function renderValueSummary(value: unknown): string {
  if (value === null) return "null";
  if (value === undefined) return "undefined";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") return String(value);
  if (typeof value === "string") {
    if (looksLikeIsoDate(value)) return formatDateTime(value);
    return value;
  }
  if (Array.isArray(value)) return `[array:${value.length}]`;
  if (isPlainObject(value)) return "{object}";
  return JSON.stringify(value);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function collectChangedFields(
  oldValue: unknown,
  newValue: unknown,
  prefix = ""
): ChangedField[] {
  if (isPlainObject(oldValue) && isPlainObject(newValue)) {
    const keys = [...new Set([...Object.keys(oldValue), ...Object.keys(newValue)])];
    return keys.flatMap((key) =>
      collectChangedFields(
        oldValue[key],
        newValue[key],
        prefix ? `${prefix}.${key}` : key
      )
    );
  }

  if (Array.isArray(oldValue) && Array.isArray(newValue)) {
    if (JSON.stringify(oldValue) === JSON.stringify(newValue)) return [];
    return [{ path: prefix || "(root)", oldValue, newValue, kind: "changed" }];
  }

  if (JSON.stringify(oldValue) === JSON.stringify(newValue)) return [];
  const kind =
    oldValue === undefined
      ? "added"
      : newValue === undefined
        ? "removed"
        : "changed";
  return [{ path: prefix || "(root)", oldValue, newValue, kind }];
}

export default function AdminActivityPage() {
  const [rows, setRows] = useState<ActivityRow[]>([]);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [changedByUserId, setChangedByUserId] = useState("");
  const [actionFilter, setActionFilter] = useState("");
  const [entityTypeFilter, setEntityTypeFilter] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [selectedRow, setSelectedRow] = useState<ActivityRow | null>(null);
  // Incrementing this triggers a reload without changing page — used by applyFilters/reset
  // so filters take effect even when page is already 1.
  const [filterVersion, setFilterVersion] = useState(0);

  async function loadUsers() {
    const res = await fetch("/api/admin/users?include_inactive=true");
    const json = await res.json();
    if (!res.ok) {
      throw new Error(json?.error?.message ?? "Failed to load users");
    }
    setUsers((json.data ?? []) as UserRow[]);
  }

  async function loadRows() {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("page_size", String(PAGE_SIZE));
      if (q.trim()) params.set("q", q.trim());
      if (changedByUserId) params.set("changed_by_user_id", changedByUserId);
      if (actionFilter) params.set("action", actionFilter);
      if (entityTypeFilter) params.set("entity_type", entityTypeFilter);
      if (fromDate) params.set("from", fromDate);
      if (toDate) params.set("to", toDate);
      const res = await fetch(`/api/admin/activity-logs?${params.toString()}`);
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error?.message ?? "Failed to load activity logs");
      }
      setRows((json.data?.rows ?? []) as ActivityRow[]);
      setTotal(Number(json.data?.total ?? 0));
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to load activity logs";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  async function exportCsv() {
    try {
      const params = new URLSearchParams();
      params.set("format", "csv");
      if (q.trim()) params.set("q", q.trim());
      if (changedByUserId) params.set("changed_by_user_id", changedByUserId);
      if (actionFilter) params.set("action", actionFilter);
      if (entityTypeFilter) params.set("entity_type", entityTypeFilter);
      if (fromDate) params.set("from", fromDate);
      if (toDate) params.set("to", toDate);
      const res = await fetch(`/api/admin/activity-logs?${params.toString()}`);
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json?.error?.message ?? "Failed to export CSV");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "activity-logs.csv";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to export CSV";
      toast.error(msg);
    }
  }

  useEffect(() => {
    void loadUsers().catch((e) => {
      const msg = e instanceof Error ? e.message : "Failed to load users";
      setError(msg);
      toast.error(msg);
    });
  }, []);

  useEffect(() => {
    void loadRows();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, filterVersion]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const canPrev = page > 1;
  const canNext = page < totalPages;

  const userLabelById = useMemo(
    () =>
      new Map(users.map((u) => [u.id, `${u.full_name || "Unknown"} (${u.email})`])),
    [users]
  );
  const changedFields = useMemo(() => {
    if (!selectedRow) return [];
    return collectChangedFields(selectedRow.old_values, selectedRow.new_values).slice(
      0,
      MAX_DIFF_ROWS
    );
  }, [selectedRow]);
  const changedFieldsTotal = useMemo(() => {
    if (!selectedRow) return 0;
    return collectChangedFields(selectedRow.old_values, selectedRow.new_values).length;
  }, [selectedRow]);

  function applyFilters() {
    setPage(1);
    setFilterVersion((v) => v + 1);
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Activity logs</h1>
        <p className="text-sm text-muted-foreground">
          Review admin-audited actions across users, warehouse access, invites, and
          penalty workflows.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
          <CardDescription>
            Search by action/entity, or narrow by actor and date range.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
          <div className="space-y-1 lg:col-span-2">
            <Label htmlFor="q">Search</Label>
            <Input
              id="q"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="action or entity type"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="action-filter">Action</Label>
            <Input
              id="action-filter"
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              placeholder="auth_login"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="entity-filter">Entity type</Label>
            <Input
              id="entity-filter"
              value={entityTypeFilter}
              onChange={(e) => setEntityTypeFilter(e.target.value)}
              placeholder="auth_session"
            />
          </div>
          <div className="space-y-1">
            <Label>Actor</Label>
            <Select
              value={changedByUserId || "__all__"}
              onValueChange={(v) => setChangedByUserId(v === "__all__" ? "" : v)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All users</SelectItem>
                {users.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.full_name} ({u.email})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="from">From</Label>
            <Input
              id="from"
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="to">To</Label>
            <Input
              id="to"
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
            />
          </div>
          <div className="sm:col-span-2 lg:col-span-6 flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setActionFilter("");
                setEntityTypeFilter("auth_session");
              }}
              disabled={loading}
            >
              Auth only
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setActionFilter("");
                setEntityTypeFilter("");
              }}
              disabled={loading}
            >
              All events
            </Button>
            <Button type="button" onClick={applyFilters} disabled={loading}>
              Apply filters
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setQ("");
                setChangedByUserId("");
                setActionFilter("");
                setEntityTypeFilter("");
                setFromDate("");
                setToDate("");
                setPage(1);
                setFilterVersion((v) => v + 1);
              }}
              disabled={loading}
            >
              Reset
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => void exportCsv()}
              disabled={loading}
            >
              Export CSV
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Events</CardTitle>
          <CardDescription>
            Showing {rows.length} of {total} event(s)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Time</TableHead>
                <TableHead>Actor</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Entity Type</TableHead>
                <TableHead>Entity ID</TableHead>
                <TableHead className="text-right">Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                    {loading ? "Loading activity..." : "No activity found for current filters."}
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="whitespace-nowrap">
                      {formatDateTime(row.changed_at)}
                    </TableCell>
                    <TableCell>
                      {row.changed_by_user_id ? (
                        row.actor ? (
                          <span>
                            {row.actor.full_name || "Unknown"}{" "}
                            <span className="text-muted-foreground">
                              ({row.actor.email})
                            </span>
                          </span>
                        ) : (
                          userLabelById.get(row.changed_by_user_id) ?? row.changed_by_user_id
                        )
                      ) : (
                        <Badge variant="outline">System</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{row.action}</Badge>
                    </TableCell>
                    <TableCell>{row.entity_type}</TableCell>
                    <TableCell className="font-mono text-xs">{row.entity_id}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedRow(row)}
                      >
                        View
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              {loading ? "Loading…" : `Page ${page} of ${totalPages}`}
            </p>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!canPrev || loading}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Previous
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!canNext || loading}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={selectedRow != null} onOpenChange={(open) => !open && setSelectedRow(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Activity details</DialogTitle>
            <DialogDescription>
              {selectedRow
                ? `${selectedRow.action} on ${selectedRow.entity_type}`
                : "Audit event"}
            </DialogDescription>
          </DialogHeader>
          {selectedRow ? (
            <div className="space-y-4">
              <div className="grid gap-2 text-sm sm:grid-cols-2">
                <div>
                  <p className="text-muted-foreground">Time</p>
                  <p>{formatDateTime(selectedRow.changed_at)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Actor</p>
                  <p>
                    {selectedRow.actor
                      ? `${selectedRow.actor.full_name || "Unknown"} (${selectedRow.actor.email})`
                      : selectedRow.changed_by_user_id ?? "System"}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Entity type</p>
                  <p>{selectedRow.entity_type}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Entity ID</p>
                  <p className="font-mono text-xs">{selectedRow.entity_id}</p>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Changed fields</Label>
                {changedFields.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No field-level diff found for this event.
                  </p>
                ) : (
                  <div className="max-h-56 overflow-auto rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Path</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>Old</TableHead>
                          <TableHead>New</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {changedFields.map((field) => (
                          <TableRow key={field.path}>
                            <TableCell className="font-mono text-xs">{field.path}</TableCell>
                            <TableCell>
                              <Badge
                                variant={
                                  field.kind === "changed"
                                    ? "secondary"
                                    : field.kind === "added"
                                      ? "default"
                                      : "outline"
                                }
                              >
                                {field.kind}
                              </Badge>
                            </TableCell>
                            <TableCell className="max-w-[16rem] truncate font-mono text-xs">
                              {renderValueSummary(field.oldValue)}
                            </TableCell>
                            <TableCell className="max-w-[16rem] truncate font-mono text-xs">
                              {renderValueSummary(field.newValue)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
                {changedFieldsTotal > MAX_DIFF_ROWS ? (
                  <p className="text-xs text-muted-foreground">
                    Showing first {MAX_DIFF_ROWS} changed fields.
                  </p>
                ) : null}
              </div>
              <div className="space-y-2">
                <Label>Old values</Label>
                <pre className="max-h-48 overflow-auto rounded-md border bg-muted/40 p-3 text-xs">
                  {JSON.stringify(selectedRow.old_values, null, 2) ?? "null"}
                </pre>
              </div>
              <div className="space-y-2">
                <Label>New values</Label>
                <pre className="max-h-48 overflow-auto rounded-md border bg-muted/40 p-3 text-xs">
                  {JSON.stringify(selectedRow.new_values, null, 2) ?? "null"}
                </pre>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

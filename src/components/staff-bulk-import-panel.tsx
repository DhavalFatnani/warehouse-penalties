"use client";

import { FormEvent, useEffect, useState } from "react";
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
import { Textarea } from "@/components/ui/textarea";
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
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Upload, FileSpreadsheet, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { StaffPageRefs } from "@/components/staff-add-panel";

type Warehouse = {
  id: string;
  code: string;
  name: string;
  is_active?: boolean;
};
type Batch = {
  id: string;
  source_filename: string;
  status: string;
  total_rows: number;
  committed_rows: number | null;
  warehouse_id: string | null;
};
type ImportRow = {
  id: string;
  row_number: number;
  validation_status: string;
  validation_errors: unknown;
  raw_payload: Record<string, unknown>;
};

const statusVariant = (s: string) => {
  if (s === "committed" || s === "partial") return "default" as const;
  if (s === "failed") return "destructive" as const;
  return "secondary" as const;
};

type StaffBulkImportPanelProps = {
  /** Called when batches change or a run completes so the parent can refresh staff lists. */
  onImportComplete?: () => void;
  /**
   * Prefetched warehouses from the staff page (null while loading).
   * When provided, avoids a duplicate GET /api/warehouses on mount.
   */
  staffRefs?: StaffPageRefs | null;
};

export function StaffBulkImportPanel({
  onImportComplete,
  staffRefs
}: StaffBulkImportPanelProps) {
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [rows, setRows] = useState<Batch[]>([]);
  const [fileName, setFileName] = useState("staff-upload.csv");
  const [csv, setCsv] = useState(
    "employee_code,full_name,staff_type_code,phone,warehouse_code\nEMP-NEW-001,Test User,PP,+15551234567,DEFAULT"
  );
  const [warehouseId, setWarehouseId] = useState("");
  const [lastSummary, setLastSummary] = useState<Record<
    string,
    unknown
  > | null>(null);
  const [lastPreview, setLastPreview] = useState<unknown[] | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);
  const [rowDetailBatch, setRowDetailBatch] = useState<string | null>(null);
  const [rowDetails, setRowDetails] = useState<ImportRow[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const staffTypes = staffRefs?.types ?? [];

  async function loadWarehouses() {
    const res = await fetch("/api/warehouses?include_inactive=true");
    const json = await res.json();
    setWarehouses(json.data ?? []);
  }

  async function loadBatches() {
    const res = await fetch("/api/imports");
    const json = await res.json();
    setRows(json.data ?? []);
  }

  useEffect(() => {
    void loadBatches();
  }, []);

  useEffect(() => {
    if (staffRefs === undefined) {
      void loadWarehouses();
      return;
    }
    if (staffRefs === null) {
      return;
    }
    setWarehouses(staffRefs.warehouses);
  }, [staffRefs]);

  async function loadRowDetails(batchId: string) {
    const res = await fetch(`/api/imports/${batchId}/rows`);
    const json = await res.json();
    if (!res.ok) {
      const msg = json?.error?.message ?? "Failed to load rows";
      setLastError(msg);
      toast.error(msg);
      return;
    }
    setRowDetails(json.data ?? []);
    setRowDetailBatch(batchId);
  }

  function onFileSelected(file: File | undefined) {
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setCsv(reader.result);
      }
    };
    reader.readAsText(file);
  }

  async function createAndRun(e: FormEvent) {
    e.preventDefault();
    setLastError(null);
    setLastSummary(null);
    setLastPreview(null);
    setSubmitting(true);

    try {
      const created = await fetch("/api/imports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source_filename: fileName,
          ...(warehouseId ? { warehouse_id: warehouseId } : {})
        })
      });
      const createdJson = await created.json();
      if (!created.ok) {
        const msg =
          createdJson?.error?.message ?? JSON.stringify(createdJson.error);
        setLastError(msg);
        toast.error(msg);
        return;
      }

      const batchId = createdJson?.data?.id;
      if (!batchId) {
        setLastError("No batch id returned");
        toast.error("No batch id returned");
        return;
      }

      const put = await fetch("/api/imports", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          batch_id: batchId,
          csv,
          ...(warehouseId ? { warehouse_id: warehouseId } : {})
        })
      });
      const putJson = await put.json();
      if (!put.ok) {
        const msg =
          putJson?.error?.message ?? JSON.stringify(putJson.error);
        setLastError(msg);
        toast.error(msg);
        await loadBatches();
        return;
      }

      setLastSummary(
        (putJson.data?.summary as Record<string, unknown>) ?? null
      );
      setLastPreview((putJson.data?.preview as unknown[]) ?? null);
      toast.success("Import batch processed");
      await loadBatches();
      await loadRowDetails(batchId);
      onImportComplete?.();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-8">
      <Card>
        <CardHeader>
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border bg-muted/50">
              <Upload className="h-5 w-5 text-muted-foreground" />
            </div>
            <div className="space-y-1">
              <CardTitle className="text-base">Bulk add staff</CardTitle>
              <CardDescription>
                Paste or upload CSV. Required:{" "}
                <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
                  employee_code
                </code>
                ,{" "}
                <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
                  full_name
                </code>
                ,{" "}
                <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
                  staff_type_code
                </code>{" "}
                (must match a configured type). Per-row site:{" "}
                <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
                  warehouse_code
                </code>{" "}
                or{" "}
                <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
                  warehouse_id
                </code>{" "}
                (UUID). Optional default warehouse below only fills rows that omit
                both; if every row has a site column, pick{" "}
                <span className="font-medium text-foreground">No default</span>.
                Optional:{" "}
                <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
                  phone
                </code>
                .
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <form className="space-y-6" onSubmit={createAndRun}>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="filename">Source file name</Label>
                <Input
                  id="filename"
                  value={fileName}
                  onChange={(e) => setFileName(e.target.value)}
                  placeholder="staff-upload.csv"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Default warehouse (optional)</Label>
                <Select
                  value={warehouseId || "__no_default_wh__"}
                  onValueChange={(v) =>
                    setWarehouseId(v === "__no_default_wh__" ? "" : v)
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="No default — CSV per row" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__no_default_wh__">
                      No default — use warehouse per CSV row only
                    </SelectItem>
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
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="csv-file">Load from file (optional)</Label>
              <Input
                id="csv-file"
                type="file"
                accept=".csv,text/csv"
                className="max-w-md cursor-pointer"
                onChange={(e) =>
                  onFileSelected(e.target.files?.[0] ?? undefined)
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="csv">CSV contents</Label>
              <Textarea
                id="csv"
                rows={10}
                value={csv}
                onChange={(e) => setCsv(e.target.value)}
                className="min-h-[200px] resize-y font-mono text-sm"
                placeholder="employee_code,full_name,staff_type_code,phone,warehouse_code"
              />
            </div>

            <div className="space-y-2 rounded-md border bg-muted/20 p-3">
              <Label className="text-xs text-muted-foreground">
                Staff type code legend
              </Label>
              {staffTypes.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No staff types found.
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {staffTypes.map((t) => (
                    <Badge key={t.id} variant="secondary" className="font-normal">
                      <span className="font-mono text-xs">{t.code}</span>
                      <span className="mx-1 text-muted-foreground">—</span>
                      <span>{t.display_name}</span>
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            <Button type="submit" disabled={submitting}>
              <FileSpreadsheet className="mr-2 h-4 w-4" />
              {submitting ? "Processing…" : "Create batch & commit valid rows"}
            </Button>
          </form>

          {lastError ? (
            <div
              className={cn(
                "mt-6 flex gap-3 rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm"
              )}
            >
              <AlertCircle className="h-5 w-5 shrink-0 text-destructive" />
              <div>
                <p className="font-medium text-destructive">Error</p>
                <p className="text-muted-foreground">{lastError}</p>
              </div>
            </div>
          ) : null}

          {lastSummary ? (
            <div className="mt-6 space-y-2">
              <Label className="text-muted-foreground">Result summary</Label>
              <ScrollArea className="max-h-48 rounded-md border bg-muted/30 p-4">
                <pre className="text-xs font-mono leading-relaxed">
                  {JSON.stringify(lastSummary, null, 2)}
                </pre>
              </ScrollArea>
            </div>
          ) : null}

          {lastPreview && lastPreview.length ? (
            <div className="mt-6 space-y-2">
              <Label className="text-muted-foreground">
                Preview (first rows)
              </Label>
              <ScrollArea className="max-h-48 rounded-md border bg-muted/30 p-4">
                <pre className="text-xs font-mono leading-relaxed">
                  {JSON.stringify(lastPreview, null, 2)}
                </pre>
              </ScrollArea>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent batches</CardTitle>
          <CardDescription>
            Validation status and committed row counts per upload.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[30%]">File</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right tabular-nums">Total</TableHead>
                <TableHead className="text-right tabular-nums">
                  Committed
                </TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="py-8 text-center text-muted-foreground"
                  >
                    No batches yet.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">
                      {r.source_filename ?? "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusVariant(r.status)}>
                        {r.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {r.total_rows}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {r.committed_rows ?? 0}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => void loadRowDetails(r.id)}
                      >
                        View rows
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {rowDetailBatch ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Row validation</CardTitle>
            <CardDescription>
              {(() => {
                const meta = rows.find((x) => x.id === rowDetailBatch);
                return meta?.source_filename
                  ? `Batch: ${meta.source_filename}`
                  : "Row validation details";
              })()}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">#</TableHead>
                  <TableHead className="w-28">Status</TableHead>
                  <TableHead>Errors / payload</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rowDetails.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="tabular-nums text-muted-foreground">
                      {row.row_number}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          row.validation_status === "valid"
                            ? "secondary"
                            : "destructive"
                        }
                      >
                        {row.validation_status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <pre className="max-h-32 overflow-auto whitespace-pre-wrap break-words rounded-md bg-muted/50 p-2 text-xs font-mono">
                        {row.validation_errors
                          ? JSON.stringify(row.validation_errors, null, 2)
                          : "—"}
                      </pre>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

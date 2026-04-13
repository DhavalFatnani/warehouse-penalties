"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useDashboardWarehouse } from "@/components/dashboard-warehouse-context";

type ImportRowResult = {
  row_number: number;
  status: "created" | "error";
  record_id?: string;
  message?: string;
};

const SAMPLE = `employee_code,penalty_code,incident_date,notes
EMP-RIDER-001,LATEIN,2026-04-01,Late at shift start`;

export function PenaltyBulkImportPanel() {
  const { warehouseId, warehousesLoading, userRole } = useDashboardWarehouse();
  const [csv, setCsv] = useState(SAMPLE);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    summary: { total_rows: number; created: number; failed: number };
    rows: ImportRowResult[];
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  function onFile(file: File | undefined) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") setCsv(reader.result);
    };
    reader.readAsText(file);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!warehouseId) {
      toast.error(
        userRole === "admin"
          ? "Choose a site from Site scope"
          : "No warehouse selected"
      );
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/penalty-records/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ warehouse_id: warehouseId, csv })
      });
      const json = await res.json();
      if (!res.ok) {
        const msg = json?.error?.message ?? "Import failed";
        setError(msg);
        toast.error(msg);
        return;
      }
      setResult({
        summary: json.data.summary,
        rows: json.data.results ?? []
      });
      toast.success("Penalty import completed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Bulk penalty import</CardTitle>
        <CardDescription>
          Import penalties by CSV for the selected site. Required columns:{" "}
          <code>employee_code</code>, <code>penalty_code</code>,{" "}
          <code>incident_date</code>. Optional: <code>notes</code>,{" "}
          <code>override_amount</code>, <code>penalty_definition_id</code> (legacy).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="csv-file">CSV file</Label>
            <Input
              id="csv-file"
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => onFile(e.target.files?.[0] ?? undefined)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="csv-text">CSV contents</Label>
            <Textarea
              id="csv-text"
              rows={12}
              value={csv}
              onChange={(e) => setCsv(e.target.value)}
              className="font-mono text-xs"
            />
          </div>
          <Button type="submit" disabled={loading || warehousesLoading || !warehouseId}>
            {loading ? "Importing..." : "Import penalties"}
          </Button>
        </form>

        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        {result ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm">
              <Badge variant="secondary">Total {result.summary.total_rows}</Badge>
              <Badge>Created {result.summary.created}</Badge>
              <Badge variant="destructive">Failed {result.summary.failed}</Badge>
            </div>
            <div className="max-h-72 overflow-auto rounded-md border p-2">
              {result.rows.map((r) => (
                <div key={r.row_number} className="text-sm">
                  Row {r.row_number}:{" "}
                  {r.status === "created" ? (
                    <span className="text-emerald-600">{r.record_id}</span>
                  ) : (
                    <span className="text-destructive">{r.message}</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        ) : null}

        <p className="text-xs text-muted-foreground">
          For single records, use <Link href="/dashboard/apply" className="underline">Apply penalty</Link>.
        </p>
      </CardContent>
    </Card>
  );
}

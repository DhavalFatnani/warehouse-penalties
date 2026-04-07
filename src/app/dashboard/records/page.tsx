"use client";

import { useCallback, useEffect, useState } from "react";
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

type Row = Record<string, unknown>;

export default function RecordsPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [status, setStatus] = useState<string>("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const p = new URLSearchParams();
      if (status !== "all") p.set("status", status);
      if (from) p.set("incident_date_from", from);
      if (to) p.set("incident_date_to", to);
      const res = await fetch(`/api/penalty-records?${p}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message ?? "Failed");
      setRows(json.data ?? []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }, [status, from, to]);

  useEffect(() => {
    void load();
  }, [load]);

  async function settle(id: string) {
    try {
      const res = await fetch(`/api/penalty-records/${id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "settled" })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message ?? "Failed");
      toast.success("Marked settled");
      void load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Penalty records</h1>
          <p className="text-sm text-muted-foreground">
            Filter by date and status. Settle when payroll has processed a penalty.
          </p>
        </div>
        <Button asChild size="sm">
          <Link href="/dashboard/apply">Apply penalty</Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Filters</CardTitle>
          <CardDescription>Incident date range and settlement status</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-4">
          <div className="space-y-1">
            <Label>Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="created">Created (open)</SelectItem>
                <SelectItem value="settled">Settled</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>From</Label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>To</Label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <div className="flex items-end">
            <Button variant="secondary" onClick={() => void load()} disabled={loading}>
              Apply filters
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="sticky top-0 bg-card">Staff</TableHead>
                <TableHead className="sticky top-0 bg-card">Type</TableHead>
                <TableHead className="sticky top-0 bg-card">Amount</TableHead>
                <TableHead className="sticky top-0 bg-card">Status</TableHead>
                <TableHead className="sticky top-0 bg-card">Date</TableHead>
                <TableHead className="sticky top-0 bg-card text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-muted-foreground">
                    No records
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((row) => (
                  <TableRow key={String(row.id)}>
                    <TableCell className="font-medium">
                      {String(row.staff_full_name ?? "")}
                    </TableCell>
                    <TableCell>{String(row.penalty_title ?? "")}</TableCell>
                    <TableCell className="tabular-nums">
                      {formatMoney(Number(row.computed_amount ?? 0))}
                    </TableCell>
                    <TableCell>
                      <Badge variant={row.status === "created" ? "secondary" : "outline"}>
                        {String(row.status ?? "")}
                      </Badge>
                    </TableCell>
                    <TableCell>{String(row.incident_date ?? "")}</TableCell>
                    <TableCell className="text-right">
                      {row.proof_url ? (
                        <Button variant="link" size="sm" asChild className="h-auto p-0">
                          <a href={String(row.proof_url)} target="_blank" rel="noreferrer">
                            Proof
                          </a>
                        </Button>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                      {row.status === "created" && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="ml-2"
                          onClick={() => void settle(String(row.id))}
                        >
                          Settle
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
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

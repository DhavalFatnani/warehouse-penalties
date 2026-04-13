import Link from "next/link";
import { getCurrentAppUser } from "@/lib/auth";
import { fetchDashboardStats } from "@/lib/dashboard-stats";
import { adminClient } from "@/lib/supabase/admin";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import { ArrowRight, Gavel } from "lucide-react";

export default async function DashboardPage({
  searchParams
}: {
  searchParams: { warehouse_id?: string };
}) {
  const { appUser } = await getCurrentAppUser();
  const stats = await fetchDashboardStats(appUser, searchParams.warehouse_id ?? null);

  const { data: warehouses } = await adminClient
    .from("warehouses")
    .select("id, name, code")
    .eq("is_active", true)
    .order("name");

  let whList = warehouses ?? [];
  if (appUser.role !== "admin") {
    const { data: access } = await adminClient
      .from("user_warehouse_access")
      .select("warehouse_id")
      .eq("user_id", appUser.id);
    const allowed = new Set((access ?? []).map((a) => a.warehouse_id));
    whList = whList.filter((w) => allowed.has(w.id));
  }

  const whQ = searchParams.warehouse_id
    ? `?warehouse_id=${encodeURIComponent(searchParams.warehouse_id)}`
    : "";

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Open penalties and recent activity. Use{" "}
            <span className="font-medium text-foreground">Site scope</span> in
            the sidebar to filter by warehouse.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild size="sm">
            <Link href={`/dashboard/apply${whQ}`}>
              <Gavel className="mr-2 h-4 w-4" />
              Apply penalty
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Pending (unpaid)</CardDescription>
            <CardTitle className="text-3xl tabular-nums">
              {stats.pending_count}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Total amount:{" "}
            <span className="font-medium text-foreground">
              {formatMoney(stats.pending_total_amount)}
            </span>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Settled (in view)</CardDescription>
            <CardTitle className="text-3xl tabular-nums">
              {stats.settled_count_cycle}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Records loaded for analytics (latest 2000 rows).
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Top staff (pending)</CardDescription>
            <CardTitle className="text-lg leading-snug">
              {stats.top_staff[0]?.name ?? "—"}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {stats.top_staff[0]
              ? `${formatMoney(stats.top_staff[0].total)} · ${stats.top_staff[0].count} penalties`
              : "No open penalties."}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top penalized staff</CardTitle>
            <CardDescription>Open penalties only</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Staff</TableHead>
                  <TableHead className="text-right">Count</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stats.top_staff.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-muted-foreground">
                      No data
                    </TableCell>
                  </TableRow>
                ) : (
                  stats.top_staff.map((row) => (
                    <TableRow key={row.staff_id}>
                      <TableCell className="font-medium">{row.name}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {row.count}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatMoney(row.total)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="text-base">Recent penalties</CardTitle>
              <CardDescription>Latest across statuses</CardDescription>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link href={`/dashboard/records${whQ}`}>
                All
                <ArrowRight className="ml-1 h-3 w-3" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Staff</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Amt</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stats.recent.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-muted-foreground">
                      No records
                    </TableCell>
                  </TableRow>
                ) : (
                  stats.recent.map((r: Record<string, unknown>) => (
                    <TableRow key={String(r.id)}>
                      <TableCell className="max-w-[120px] truncate font-medium">
                        {String(r.staff_full_name ?? "")}
                      </TableCell>
                      <TableCell className="max-w-[100px] truncate text-muted-foreground">
                        {String(r.penalty_title ?? "")}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            r.status === "created" ? "secondary" : "outline"
                          }
                        >
                          {String(r.status ?? "")}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatMoney(Number(r.computed_amount ?? 0))}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
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

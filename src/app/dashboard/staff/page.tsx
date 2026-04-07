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
  StaffAddPanel,
  type StaffPageRefs
} from "@/components/staff-add-panel";
import { StaffBulkImportPanel } from "@/components/staff-bulk-import-panel";

type Staff = {
  id: string;
  full_name: string;
  employee_code: string;
  is_active: boolean;
  warehouse_id: string | null;
};

const TAB_VALUES = ["directory", "add", "bulk"] as const;
type TabValue = (typeof TAB_VALUES)[number];

function parseTab(v: string | null): TabValue {
  if (v === "add" || v === "bulk" || v === "directory") return v;
  return "directory";
}

function StaffHubContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tab = parseTab(searchParams.get("tab"));

  const [rows, setRows] = useState<Staff[]>([]);
  const [q, setQ] = useState("");
  const [staffRefs, setStaffRefs] = useState<StaffPageRefs | null>(null);

  const loadStaff = useCallback(() => {
    void fetch("/api/staff")
      .then((r) => r.json())
      .then((j) => setRows(j.data ?? []));
  }, []);

  useEffect(() => {
    if (tab === "directory") {
      loadStaff();
    }
  }, [tab, loadStaff]);

  /** Load warehouses + staff types once so the Add tab form renders immediately. */
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
    return rows.filter(
      (r) =>
        r.full_name.toLowerCase().includes(s) ||
        r.employee_code.toLowerCase().includes(s)
    );
  }, [rows, q]);

  function setTab(next: string) {
    const t = parseTab(next);
    router.replace(`/dashboard/staff?tab=${t}`);
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Staff</h1>
        <p className="text-sm text-muted-foreground">
          Directory, add one person, or bulk CSV. Records are never deleted.
        </p>
      </div>

      <Tabs value={tab} onValueChange={setTab} className="w-full">
        <TabsList className="grid w-full max-w-xl grid-cols-3 sm:inline-flex sm:w-auto">
          <TabsTrigger value="directory">Directory</TabsTrigger>
          <TabsTrigger value="add">Add staff</TabsTrigger>
          <TabsTrigger value="bulk">Bulk add</TabsTrigger>
        </TabsList>

        <TabsContent value="directory" className="space-y-4 pt-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-end">
            <Input
              placeholder="Search…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="max-w-sm sm:ml-auto"
            />
          </div>

          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Employee ID</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.full_name}</TableCell>
                    <TableCell className="font-mono text-sm">
                      {r.employee_code}
                    </TableCell>
                    <TableCell>
                      <Badge variant={r.is_active ? "secondary" : "outline"}>
                        {r.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" asChild>
                        <Link href={`/dashboard/staff/${r.id}`}>Edit</Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="add" className="pt-4">
          <div className="mx-auto max-w-lg">
            <StaffAddPanel
              staffRefs={staffRefs}
              onStaffAdded={() => {
                loadStaff();
              }}
            />
          </div>
        </TabsContent>

        <TabsContent value="bulk" className="pt-4">
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

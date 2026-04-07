"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";

type WarehouseRow = {
  id: string;
  code: string;
  name: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

const emptyForm = {
  code: "",
  name: "",
  is_active: true
};

export default function AdminWarehousesPage() {
  const [roleGate, setRoleGate] = useState<"loading" | "admin" | "other">(
    "loading"
  );
  const [rows, setRows] = useState<WarehouseRow[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [editRow, setEditRow] = useState<WarehouseRow | null>(null);
  const [createForm, setCreateForm] = useState(emptyForm);
  const [editForm, setEditForm] = useState(emptyForm);
  const [loading, setLoading] = useState(false);

  async function load() {
    const res = await fetch("/api/warehouses");
    const json = await res.json();
    if (!res.ok) {
      toast.error(json?.error?.message ?? "Failed to load warehouses");
      return;
    }
    setRows((json.data ?? []) as WarehouseRow[]);
  }

  useEffect(() => {
    void fetch("/api/me")
      .then((r) => r.json())
      .then((json) => {
        const r0 = json.data?.role;
        setRoleGate(r0 === "admin" ? "admin" : "other");
      })
      .catch(() => setRoleGate("other"));
  }, []);

  useEffect(() => {
    if (roleGate !== "admin") return;
    void load();
  }, [roleGate]);

  function openEdit(row: WarehouseRow) {
    setEditRow(row);
    setEditForm({
      code: row.code,
      name: row.name,
      is_active: row.is_active
    });
  }

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/warehouses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: createForm.code.trim(),
          name: createForm.name.trim(),
          is_active: createForm.is_active
        })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message ?? "Create failed");
      toast.success("Warehouse created");
      setCreateOpen(false);
      setCreateForm(emptyForm);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  async function onEditSave(e: FormEvent) {
    e.preventDefault();
    if (!editRow) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/warehouses/${editRow.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: editForm.code.trim(),
          name: editForm.name.trim(),
          is_active: editForm.is_active
        })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message ?? "Update failed");
      toast.success("Warehouse updated");
      setEditRow(null);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  async function toggleActive(row: WarehouseRow) {
    try {
      const res = await fetch(`/api/warehouses/${row.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: !row.is_active })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message ?? "Update failed");
      toast.success(
        !row.is_active ? "Warehouse activated" : "Warehouse deactivated"
      );
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error");
    }
  }

  async function remove(row: WarehouseRow) {
    if (
      !window.confirm(
        `Delete warehouse “${row.code}” permanently? This only works if nothing references it.`
      )
    ) {
      return;
    }
    try {
      const res = await fetch(`/api/warehouses/${row.id}`, {
        method: "DELETE"
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message ?? "Delete failed");
      toast.success("Warehouse deleted");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error");
    }
  }

  if (roleGate === "loading") {
    return (
      <div className="mx-auto max-w-4xl p-6 text-sm text-muted-foreground">
        Loading…
      </div>
    );
  }

  if (roleGate !== "admin") {
    return (
      <div className="mx-auto max-w-lg space-y-4 p-6">
        <Card>
          <CardHeader>
            <CardTitle>Admin only</CardTitle>
            <CardDescription>
              Managing warehouses requires an administrator account.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline">
              <Link href="/dashboard">Back to dashboard</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Warehouses</h1>
          <p className="text-sm text-muted-foreground">
            Create sites, rename them, and activate or deactivate them. Grant
            managers access under{" "}
            <Link
              href="/dashboard/admin/access"
              className="font-medium text-foreground underline underline-offset-4"
            >
              Warehouse access
            </Link>
            .
          </p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button>New warehouse</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <form onSubmit={onCreate}>
              <DialogHeader>
                <DialogTitle>Create warehouse</DialogTitle>
                <DialogDescription>
                  Code is a short unique label (e.g. WH-NORTH). Name is the
                  display title.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-3 py-4">
                <div className="space-y-2">
                  <Label htmlFor="c-code">Code</Label>
                  <Input
                    id="c-code"
                    value={createForm.code}
                    onChange={(e) =>
                      setCreateForm({
                        ...createForm,
                        code: e.target.value.toUpperCase()
                      })
                    }
                    placeholder="WH-01"
                    required
                    minLength={1}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="c-name">Name</Label>
                  <Input
                    id="c-name"
                    value={createForm.name}
                    onChange={(e) =>
                      setCreateForm({ ...createForm, name: e.target.value })
                    }
                    placeholder="North fulfillment center"
                    required
                    minLength={1}
                  />
                </div>
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <Label htmlFor="c-active">Active</Label>
                    <p className="text-xs text-muted-foreground">
                      Inactive sites stay hidden from most assignment pickers.
                    </p>
                  </div>
                  <Switch
                    id="c-active"
                    checked={createForm.is_active}
                    onCheckedChange={(v) =>
                      setCreateForm({ ...createForm, is_active: v })
                    }
                  />
                </div>
              </div>
              <DialogFooter>
                <Button type="submit" disabled={loading}>
                  Create
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={4}
                  className="text-center text-muted-foreground"
                >
                  No warehouses yet. Create one to get started.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-mono text-sm">{row.code}</TableCell>
                  <TableCell className="font-medium">{row.name}</TableCell>
                  <TableCell>
                    {row.is_active ? (
                      <Badge>Active</Badge>
                    ) : (
                      <Badge variant="secondary">Inactive</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleActive(row)}
                      >
                        {row.is_active ? "Deactivate" : "Activate"}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => openEdit(row)}
                        aria-label="Edit warehouse"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => remove(row)}
                        aria-label="Delete warehouse"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog
        open={editRow !== null}
        onOpenChange={(v) => {
          if (!v) setEditRow(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <form onSubmit={onEditSave}>
            <DialogHeader>
              <DialogTitle>Edit warehouse</DialogTitle>
              <DialogDescription>
                Changing the code updates how it appears in exports and filters.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-3 py-4">
              <div className="space-y-2">
                <Label htmlFor="e-code">Code</Label>
                <Input
                  id="e-code"
                  value={editForm.code}
                  onChange={(e) =>
                    setEditForm({
                      ...editForm,
                      code: e.target.value.toUpperCase()
                    })
                  }
                  required
                  minLength={1}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="e-name">Name</Label>
                <Input
                  id="e-name"
                  value={editForm.name}
                  onChange={(e) =>
                    setEditForm({ ...editForm, name: e.target.value })
                  }
                  required
                  minLength={1}
                />
              </div>
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <Label htmlFor="e-active">Active</Label>
                  <p className="text-xs text-muted-foreground">
                    Deactivate to block new assignments without deleting data.
                  </p>
                </div>
                <Switch
                  id="e-active"
                  checked={editForm.is_active}
                  onCheckedChange={(v) =>
                    setEditForm({ ...editForm, is_active: v })
                  }
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="submit" disabled={loading}>
                Save changes
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

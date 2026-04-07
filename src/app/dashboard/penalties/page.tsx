"use client";

import { FormEvent, useEffect, useState } from "react";
import { toast } from "sonner";
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
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";

type StaffTypeRow = { id: string; code: string; display_name: string };
type Def = {
  id: string;
  code?: string;
  title?: string;
  category?: string | null;
  default_amount?: number | null;
  structure_model?: string;
  staff_types?: { id: string; code: string; display_name: string }[];
};

export default function PenaltyDefinitionsPage() {
  const [rows, setRows] = useState<Def[]>([]);
  const [staffTypes, setStaffTypes] = useState<StaffTypeRow[]>([]);
  const [staffTypeIds, setStaffTypeIds] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    code: "",
    title: "",
    description: "",
    category: "",
    default_amount: ""
  });

  async function load() {
    const res = await fetch("/api/penalty-definitions");
    const json = await res.json();
    setRows((json.data ?? []) as Def[]);
  }

  useEffect(() => {
    void load();
    void fetch("/api/staff-types")
      .then((r) => r.json())
      .then((json) => {
        const list = (json.data ?? []) as StaffTypeRow[];
        setStaffTypes(list);
        setStaffTypeIds(list.map((s) => s.id));
      });
  }, []);

  function toggleStaffType(id: string, checked: boolean) {
    setStaffTypeIds((prev) => {
      if (checked) return prev.includes(id) ? prev : [...prev, id];
      return prev.filter((x) => x !== id);
    });
  }

  function resetStaffTypesToAll() {
    setStaffTypeIds(staffTypes.map((s) => s.id));
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const defaultAmount = form.default_amount
        ? Number(form.default_amount)
        : null;
      if (staffTypeIds.length === 0) {
        toast.error("Select at least one staff type");
        setLoading(false);
        return;
      }
      const body = {
        code: form.code.trim().toUpperCase(),
        title: form.title.trim(),
        description: form.description.trim() || null,
        category: form.category.trim() || null,
        default_amount: defaultAmount,
        structure_model: "fixed_per_occurrence",
        occurrence_scope: "all_time",
        structure_config:
          defaultAmount != null ? { amount: defaultAmount } : {},
        staff_type_ids: staffTypeIds
      };
      const res = await fetch("/api/penalty-definitions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message ?? "Failed");
      toast.success("Definition created");
      setOpen(false);
      setForm({
        code: "",
        title: "",
        description: "",
        category: "",
        default_amount: ""
      });
      resetStaffTypesToAll();
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Penalty definitions
          </h1>
          <p className="text-sm text-muted-foreground">
            Reusable penalty types with default amounts. Advanced structure models
            remain available in the database.
          </p>
        </div>
        <Dialog
          open={open}
          onOpenChange={(v) => {
            setOpen(v);
            if (v && staffTypes.length > 0) resetStaffTypesToAll();
          }}
        >
          <DialogTrigger asChild>
            <Button>New definition</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <form onSubmit={onSubmit}>
              <DialogHeader>
                <DialogTitle>Create penalty type</DialogTitle>
                <DialogDescription>
                  Fixed amount per occurrence for the common case.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-3 py-4">
                <div className="space-y-2">
                  <Label htmlFor="code">Code</Label>
                  <Input
                    id="code"
                    value={form.code}
                    onChange={(e) =>
                      setForm({ ...form, code: e.target.value.toUpperCase() })
                    }
                    placeholder="LATE"
                    required
                    minLength={2}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="title">Name</Label>
                  <Input
                    id="title"
                    value={form.title}
                    onChange={(e) =>
                      setForm({ ...form, title: e.target.value })
                    }
                    placeholder="Late arrival"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cat">Category (optional)</Label>
                  <Input
                    id="cat"
                    value={form.category}
                    onChange={(e) =>
                      setForm({ ...form, category: e.target.value })
                    }
                    placeholder="Attendance"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="amt">Default amount</Label>
                  <Input
                    id="amt"
                    type="number"
                    min={0}
                    step="0.01"
                    value={form.default_amount}
                    onChange={(e) =>
                      setForm({ ...form, default_amount: e.target.value })
                    }
                    placeholder="100"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="desc">Description</Label>
                  <Textarea
                    id="desc"
                    value={form.description}
                    onChange={(e) =>
                      setForm({ ...form, description: e.target.value })
                    }
                    rows={3}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Applies to staff types</Label>
                  <p className="text-xs text-muted-foreground">
                    Only these roles can receive this penalty when applying.
                  </p>
                  <div className="max-h-40 space-y-2 overflow-y-auto rounded-md border p-3">
                    {staffTypes.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        Loading types…
                      </p>
                    ) : (
                      staffTypes.map((st) => (
                        <label
                          key={st.id}
                          className="flex cursor-pointer items-center gap-2 text-sm"
                        >
                          <Checkbox
                            checked={staffTypeIds.includes(st.id)}
                            onCheckedChange={(c) =>
                              toggleStaffType(st.id, c === true)
                            }
                          />
                          <span className="font-mono text-xs text-muted-foreground">
                            {st.code}
                          </span>
                          <span>{st.display_name}</span>
                        </label>
                      ))
                    )}
                  </div>
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
              <TableHead>Category</TableHead>
              <TableHead className="text-right">Default</TableHead>
              <TableHead>Applies to</TableHead>
              <TableHead>Model</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={String(r.id)}>
                <TableCell className="font-mono text-sm">
                  {String(r.code ?? "")}
                </TableCell>
                <TableCell className="font-medium">{String(r.title ?? "")}</TableCell>
                <TableCell>
                  <Badge variant="outline">{String(r.category ?? "")}</Badge>
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {r.default_amount != null
                    ? String(r.default_amount)
                    : "—"}
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {(r.staff_types ?? []).map((st) => (
                      <Badge key={st.id} variant="secondary" className="font-normal">
                        {st.code}
                      </Badge>
                    ))}
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">
                  {String(r.structure_model ?? "")}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

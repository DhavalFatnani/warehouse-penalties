"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { useDashboardWarehouse } from "@/components/dashboard-warehouse-context";
import type { PenaltyCodeApiRow } from "@/lib/penalty-code-row";
import { warehouseScopeDisplayLabel } from "@/lib/penalty-code-row";

type StaffTypeRow = { id: string; code: string; display_name: string };
type WarehouseRow = {
  id: string;
  code: string;
  name: string;
  is_active?: boolean;
};
type PenaltyCodeRow = PenaltyCodeApiRow;
type Def = {
  id: string;
  code?: string | null;
  title?: string;
  default_amount?: number | null;
  structure_model?: string;
  warehouse_id?: string | null;
  warehouse?: { id: string; code: string; name: string } | null;
  staff_types?: { id: string; code: string; display_name: string }[];
};

function definitionWarehouseLabel(
  r: Def,
  lookup: WarehouseRow[]
): string {
  if (r.warehouse && (r.warehouse.code || r.warehouse.name)) {
    return `${r.warehouse.code} — ${r.warehouse.name}`;
  }
  if (!r.warehouse_id) return "Global";
  const w = lookup.find((x) => x.id === r.warehouse_id);
  if (w && (w.code || w.name)) return `${w.code} — ${w.name}`;
  return "Inactive or removed site";
}

export default function PenaltyDefinitionsPage() {
  const { warehouseId } = useDashboardWarehouse();
  const [rows, setRows] = useState<Def[]>([]);
  const [staffTypes, setStaffTypes] = useState<StaffTypeRow[]>([]);
  const [warehouses, setWarehouses] = useState<WarehouseRow[]>([]);
  const [catalogCodes, setCatalogCodes] = useState<PenaltyCodeRow[]>([]);
  const [codesForDef, setCodesForDef] = useState<PenaltyCodeRow[]>([]);
  const [staffTypeIds, setStaffTypeIds] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const [codeOpen, setCodeOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [codeLoading, setCodeLoading] = useState(false);
  const [defWarehouseScope, setDefWarehouseScope] = useState<string>("");
  const [penaltyCodeId, setPenaltyCodeId] = useState<string>("");
  const [form, setForm] = useState({
    title: "",
    description: "",
    default_amount: ""
  });
  const [newCode, setNewCode] = useState({
    code: "",
    warehouse_scope: "" as "" | "global" | string
  });

  const loadDefinitions = useCallback(async () => {
    let q = "";
    if (warehouseId) {
      q = `?warehouse_id=${encodeURIComponent(warehouseId)}`;
    }
    const res = await fetch(`/api/penalty-definitions${q}`);
    const json = await res.json();
    setRows((json.data ?? []) as Def[]);
  }, [warehouseId]);

  async function loadCatalogCodes() {
    const res = await fetch("/api/penalty-codes?include_inactive=true");
    const json = await res.json();
    if (res.ok) {
      setCatalogCodes((json.data ?? []) as PenaltyCodeRow[]);
    }
  }

  useEffect(() => {
    void loadDefinitions();
  }, [loadDefinitions]);

  useEffect(() => {
    void fetch("/api/staff-types")
      .then((r) => r.json())
      .then((json) => {
        const list = (json.data ?? []) as StaffTypeRow[];
        setStaffTypes(list);
        setStaffTypeIds(list.map((s) => s.id));
      });
    void fetch("/api/warehouses?include_inactive=true")
      .then((r) => r.json())
      .then((json) => {
        const list = (json.data ?? []) as Record<string, unknown>[];
        setWarehouses(
          list.map((w) => ({
            id: String(w.id),
            code: String(w.code ?? ""),
            name: String(w.name ?? ""),
            is_active: w.is_active !== false
          }))
        );
      });
    void loadCatalogCodes();
  }, []);

  useEffect(() => {
    if (!defWarehouseScope) {
      setCodesForDef([]);
      setPenaltyCodeId("");
      return;
    }
    const param =
      defWarehouseScope === "global"
        ? "global"
        : defWarehouseScope;
    let cancelled = false;
    void fetch(
      `/api/penalty-codes?for_definition_warehouse=${encodeURIComponent(param)}`
    )
      .then((r) => r.json())
      .then((json) => {
        if (cancelled) return;
        setCodesForDef((json.data ?? []) as PenaltyCodeRow[]);
        setPenaltyCodeId((prev) =>
          (json.data ?? []).some((c: PenaltyCodeRow) => c.id === prev)
            ? prev
            : ""
        );
      });
    return () => {
      cancelled = true;
    };
  }, [defWarehouseScope]);

  function toggleStaffType(id: string, checked: boolean) {
    setStaffTypeIds((prev) => {
      if (checked) return prev.includes(id) ? prev : [...prev, id];
      return prev.filter((x) => x !== id);
    });
  }

  function resetStaffTypesToAll() {
    setStaffTypeIds(staffTypes.map((s) => s.id));
  }

  function resetDefDialog() {
    setDefWarehouseScope("");
    setPenaltyCodeId("");
    setForm({
      title: "",
      description: "",
      default_amount: ""
    });
    resetStaffTypesToAll();
  }

  async function onSubmitDefinition(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const defaultAmount = form.default_amount
        ? Number(form.default_amount)
        : null;
      if (!defWarehouseScope) {
        toast.error("Select definition scope (warehouse or global)");
        setLoading(false);
        return;
      }
      if (!penaltyCodeId) {
        toast.error("Select a penalty code from the catalog");
        setLoading(false);
        return;
      }
      if (staffTypeIds.length === 0) {
        toast.error("Select at least one staff type");
        setLoading(false);
        return;
      }
      const warehouse_id =
        defWarehouseScope === "global" ? null : defWarehouseScope;
      const body = {
        penalty_code_id: penaltyCodeId,
        warehouse_id,
        title: form.title.trim(),
        description: form.description.trim() || null,
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
      resetDefDialog();
      await loadDefinitions();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  async function onSubmitCode(e: FormEvent) {
    e.preventDefault();
    if (!newCode.code.trim()) {
      toast.error("Enter a code");
      return;
    }
    if (!newCode.warehouse_scope) {
      toast.error("Select whether the code is global or warehouse-specific");
      return;
    }
    setCodeLoading(true);
    try {
      const warehouse_id =
        newCode.warehouse_scope === "global"
          ? null
          : newCode.warehouse_scope;
      const res = await fetch("/api/penalty-codes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: newCode.code.trim(),
          warehouse_id
        })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message ?? "Failed");
      toast.success("Penalty code created");
      setCodeOpen(false);
      setNewCode({ code: "", warehouse_scope: "" });
      await loadCatalogCodes();
      if (defWarehouseScope) {
        const param =
          defWarehouseScope === "global" ? "global" : defWarehouseScope;
        const r = await fetch(
          `/api/penalty-codes?for_definition_warehouse=${encodeURIComponent(param)}`
        );
        const j = await r.json();
        if (r.ok) setCodesForDef((j.data ?? []) as PenaltyCodeRow[]);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error");
    } finally {
      setCodeLoading(false);
    }
  }

  async function setCodeActive(id: string, is_active: boolean) {
    const res = await fetch(`/api/penalty-codes/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_active })
    });
    const json = await res.json();
    if (!res.ok) {
      throw new Error(json.error?.message ?? "Failed");
    }
    await loadCatalogCodes();
    if (defWarehouseScope) {
      const param =
        defWarehouseScope === "global" ? "global" : defWarehouseScope;
      const r = await fetch(
        `/api/penalty-codes?for_definition_warehouse=${encodeURIComponent(param)}`
      );
      const j = await r.json();
      if (r.ok) setCodesForDef((j.data ?? []) as PenaltyCodeRow[]);
    }
  }

  async function onRemoveCode(c: PenaltyCodeRow) {
    if (
      !confirm(
        `Remove "${c.code}" from the catalog? Existing penalties and definitions keep using it; it will not be offered for new definitions.`
      )
    ) {
      return;
    }
    try {
      await setCodeActive(c.id, false);
      toast.success("Code removed from new definitions");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error");
    }
  }

  async function onRestoreCode(c: PenaltyCodeRow) {
    try {
      await setCodeActive(c.id, true);
      toast.success("Code restored");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error");
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Penalty definitions
        </h1>
        <p className="text-sm text-muted-foreground">
          Create <strong>penalty codes</strong> first, then attach definitions
          (title, amount, staff types) per warehouse or globally. The definition
          list follows <span className="font-medium text-foreground">Site scope</span>{" "}
          in the sidebar (admins: All warehouses = every definition you can
          access).
        </p>
      </div>

      <div className="flex flex-col gap-3 rounded-lg border p-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-medium">Penalty codes</h2>
            <p className="text-xs text-muted-foreground">
              Short identifiers (e.g. LATE). Global codes work everywhere;
              warehouse codes only for that site&apos;s definitions. Removing a
              code hides it from new definitions only — history is unchanged.
            </p>
          </div>
          <Dialog
            open={codeOpen}
            onOpenChange={(v) => {
              setCodeOpen(v);
              if (!v) setNewCode({ code: "", warehouse_scope: "" });
            }}
          >
            <DialogTrigger asChild>
              <Button type="button" variant="secondary" size="sm">
                New code
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <form onSubmit={onSubmitCode}>
                <DialogHeader>
                  <DialogTitle>Add penalty code</DialogTitle>
                  <DialogDescription>
                    Codes are reused when you create definitions.
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-3 py-4">
                  <div className="space-y-2">
                    <Label>Scope</Label>
                    <Select
                      value={newCode.warehouse_scope || undefined}
                      onValueChange={(v) =>
                        setNewCode((s) => ({ ...s, warehouse_scope: v }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Choose scope" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="global">Global (all warehouses)</SelectItem>
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
                  <div className="space-y-2">
                    <Label htmlFor="ncode">Code</Label>
                    <Input
                      id="ncode"
                      value={newCode.code}
                      onChange={(e) =>
                        setNewCode((s) => ({
                          ...s,
                          code: e.target.value.toUpperCase()
                        }))
                      }
                      placeholder="LATE"
                      required
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={codeLoading}>
                    {codeLoading ? "Saving…" : "Create code"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Scope</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {catalogCodes.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={4}
                    className="text-center text-sm text-muted-foreground"
                  >
                    No codes yet. Add one to use in definitions.
                  </TableCell>
                </TableRow>
              ) : (
                catalogCodes.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-mono text-sm">{c.code}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {warehouseScopeDisplayLabel(
                        c.warehouse_id,
                        c.warehouse,
                        warehouses
                      )}
                    </TableCell>
                    <TableCell>
                      {c.is_active ? (
                        <Badge variant="secondary">Active</Badge>
                      ) : (
                        <Badge variant="outline">Removed</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {c.is_active ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          onClick={() => void onRemoveCode(c)}
                        >
                          Remove
                        </Button>
                      ) : (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => void onRestoreCode(c)}
                        >
                          Restore
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <div className="flex justify-end">
        <Dialog
          open={open}
          onOpenChange={(v) => {
            setOpen(v);
            if (v && staffTypes.length > 0) resetStaffTypesToAll();
            if (!v) resetDefDialog();
          }}
        >
          <DialogTrigger asChild>
            <Button>New definition</Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
            <form onSubmit={onSubmitDefinition}>
              <DialogHeader>
                <DialogTitle>Create penalty type</DialogTitle>
                <DialogDescription>
                  Pick scope, then a catalog code, then details.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-3 py-4">
                <div className="space-y-2">
                  <Label>Definition scope</Label>
                  <Select
                    value={defWarehouseScope || undefined}
                    onValueChange={(v) => {
                      setDefWarehouseScope(v);
                      setPenaltyCodeId("");
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Where does this apply?" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="global">
                        Global (all warehouses)
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
                <div className="space-y-2">
                  <Label>Penalty code</Label>
                  <Select
                    value={penaltyCodeId || undefined}
                    onValueChange={setPenaltyCodeId}
                    disabled={!defWarehouseScope || codesForDef.length === 0}
                  >
                    <SelectTrigger>
                      <SelectValue
                        placeholder={
                          !defWarehouseScope
                            ? "Choose scope first"
                            : codesForDef.length === 0
                              ? "No codes — add one above"
                              : "Select code"
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {codesForDef.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          <span className="font-mono">{c.code}</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
                  {loading ? "Creating…" : "Create"}
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
              <TableHead>Warehouse</TableHead>
              <TableHead className="text-right">Default</TableHead>
              <TableHead>Applies to</TableHead>
              <TableHead>Model</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="py-10 text-center text-muted-foreground"
                >
                  No definitions match this filter.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((r) => (
                <TableRow key={String(r.id)}>
                  <TableCell className="font-mono text-sm">
                    {String(r.code ?? "")}
                  </TableCell>
                  <TableCell className="font-medium">
                    {String(r.title ?? "")}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {definitionWarehouseLabel(r, warehouses)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {r.default_amount != null
                      ? String(r.default_amount)
                      : "—"}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {(r.staff_types ?? []).map((st) => (
                        <Badge
                          key={st.id}
                          variant="secondary"
                          className="font-normal"
                        >
                          {st.display_name ?? st.code ?? "—"}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {String(r.structure_model ?? "")}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

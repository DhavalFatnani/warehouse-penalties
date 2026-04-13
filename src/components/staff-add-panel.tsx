"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
/** Dropdown data for staff forms — prefetched once on the staff hub page. */
export type StaffPageRefs = {
  warehouses: { id: string; code: string; name: string; is_active?: boolean }[];
  types: { id: string; code: string; display_name: string }[];
};

type FormState = {
  full_name: string;
  employee_code: string;
  phone: string;
  warehouse_id: string;
  staff_type_id: string;
};

type StaffAddPanelProps = {
  /** Prefetched on the staff page — avoids an empty “Loading…” shell on this tab. */
  staffRefs: StaffPageRefs | null;
  onStaffAdded?: () => void;
};

export function StaffAddPanel({ staffRefs, onStaffAdded }: StaffAddPanelProps) {
  const router = useRouter();
  const [form, setForm] = useState<FormState>({
    full_name: "",
    employee_code: "",
    phone: "",
    warehouse_id: "",
    staff_type_id: ""
  });
  const [loading, setLoading] = useState(false);

  const warehouses = staffRefs?.warehouses ?? [];
  const types = staffRefs?.types ?? [];
  const refsReady = staffRefs !== null;

  useEffect(() => {
    if (!staffRefs) return;
    setForm((f) => ({
      ...f,
      warehouse_id: f.warehouse_id || staffRefs.warehouses[0]?.id || "",
      staff_type_id: f.staff_type_id || staffRefs.types[0]?.id || ""
    }));
  }, [staffRefs]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form.staff_type_id) {
      toast.error("Select a staff type");
      return;
    }
    if (!form.warehouse_id) {
      toast.error("Select a warehouse");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/staff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name: form.full_name.trim(),
          employee_code: form.employee_code.trim(),
          phone: form.phone.trim() || null,
          warehouse_id: form.warehouse_id,
          staff_type_id: form.staff_type_id
        })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message ?? "Failed");
      toast.success("Staff added");
      setForm({
        full_name: "",
        employee_code: "",
        phone: "",
        warehouse_id: warehouses.length ? warehouses[0].id : "",
        staff_type_id: types[0]?.id ?? ""
      });
      onStaffAdded?.();
      const id = json.data?.id as string | undefined;
      if (id) {
        router.push(`/dashboard/staff/${id}`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Details</CardTitle>
        <CardDescription>
          Enter name, employee ID, optional phone, required warehouse, and
          staff type. Employee ID must be unique per warehouse.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={onSubmit}>
          <div className="space-y-2">
            <Label htmlFor="full_name">Full name</Label>
            <Input
              id="full_name"
              value={form.full_name}
              onChange={(e) =>
                setForm({ ...form, full_name: e.target.value })
              }
              required
              autoComplete="name"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="employee_code">Employee ID</Label>
            <Input
              id="employee_code"
              value={form.employee_code}
              onChange={(e) =>
                setForm({ ...form, employee_code: e.target.value })
              }
              required
              className="font-mono"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">Phone (optional)</Label>
            <Input
              id="phone"
              type="tel"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              autoComplete="tel"
            />
          </div>
          {warehouses.length > 0 && (
            <div className="space-y-2">
              <Label>Warehouse</Label>
              <Select
                value={form.warehouse_id}
                onValueChange={(v) =>
                  setForm({ ...form, warehouse_id: v })
                }
                required
                disabled={!refsReady}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={
                      refsReady ? "Select warehouse" : "Loading warehouses…"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
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
          )}
          {refsReady && warehouses.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No warehouses available for your account. Ask an administrator
              for warehouse access.
            </p>
          )}
          {(types.length > 0 || !refsReady) && (
            <div className="space-y-2">
              <Label>Staff type</Label>
              <Select
                value={form.staff_type_id}
                onValueChange={(v) =>
                  setForm({ ...form, staff_type_id: v })
                }
                disabled={!refsReady || types.length === 0}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={
                      refsReady ? undefined : "Loading staff types…"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {types.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.display_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          {refsReady && types.length === 0 && (
            <p className="text-sm text-destructive">
              No staff types configured. Contact an administrator.
            </p>
          )}
          <div className="flex gap-2">
            <Button
              type="submit"
              disabled={
                loading ||
                !refsReady ||
                !form.staff_type_id ||
                !form.warehouse_id
              }
            >
              Add staff
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

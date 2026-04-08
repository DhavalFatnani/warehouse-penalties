"use client";

import { FormEvent, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
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
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";

type Staff = {
  id: string;
  full_name: string;
  employee_code: string;
  phone: string | null;
  warehouse_id: string | null;
  staff_type_id: string;
  is_active: boolean;
};

export default function EditStaffPage() {
  const params = useParams();
  const router = useRouter();
  const id = String(params.id);
  const [staff, setStaff] = useState<Staff | null>(null);
  const [warehouses, setWarehouses] = useState<{ id: string; name: string }[]>(
    []
  );
  const [types, setTypes] = useState<{ id: string; display_name: string }[]>(
    []
  );
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    void Promise.all([
      fetch(`/api/staff/${id}`).then((r) => r.json()),
      fetch("/api/warehouses").then((r) => r.json())
    ]).then(async ([staffJson, whJson]) => {
      if (!staffJson.data) {
        toast.error("Staff not found");
        router.push("/dashboard/staff");
        return;
      }
      setStaff(staffJson.data);
      setWarehouses(whJson.data ?? []);
      const t = await fetch("/api/staff-types").catch(() => null);
      if (t?.ok) {
        const tj = await t.json();
        setTypes(tj.data ?? []);
      }
    });
  }, [id, router]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!staff) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/staff/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name: staff.full_name,
          employee_code: staff.employee_code,
          phone: staff.phone?.trim() ? staff.phone.trim() : null,
          warehouse_id: staff.warehouse_id,
          staff_type_id: staff.staff_type_id,
          is_active: staff.is_active
        })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message ?? "Failed");
      toast.success("Saved");
      router.push("/dashboard/staff");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  if (!staff) {
    return (
      <div className="text-sm text-muted-foreground">Loading…</div>
    );
  }

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Edit staff</h1>
        <p className="text-sm text-muted-foreground">{staff.employee_code}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Details</CardTitle>
          <CardDescription>Updates sync to all penalty history.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={onSubmit}>
            <div className="space-y-2">
              <Label htmlFor="full_name">Full name</Label>
              <Input
                id="full_name"
                value={staff.full_name}
                onChange={(e) =>
                  setStaff({ ...staff, full_name: e.target.value })
                }
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="employee_code">Employee ID</Label>
              <Input
                id="employee_code"
                value={staff.employee_code}
                onChange={(e) =>
                  setStaff({ ...staff, employee_code: e.target.value })
                }
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone (optional)</Label>
              <Input
                id="phone"
                type="tel"
                value={staff.phone ?? ""}
                onChange={(e) =>
                  setStaff({ ...staff, phone: e.target.value || null })
                }
              />
            </div>
            {warehouses.length > 0 && (
              <div className="space-y-2">
                <Label>Warehouse</Label>
                <Select
                  value={staff.warehouse_id ?? "none"}
                  onValueChange={(v) =>
                    setStaff({
                      ...staff,
                      warehouse_id: v === "none" ? null : v
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Warehouse" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {warehouses.map((w) => (
                      <SelectItem key={w.id} value={w.id}>
                        {w.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {types.length > 0 && (
              <div className="space-y-2">
                <Label>Staff type</Label>
                <Select
                  value={staff.staff_type_id}
                  onValueChange={(v) =>
                    setStaff({ ...staff, staff_type_id: v })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
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
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <Label htmlFor="active">Active</Label>
                <p className="text-xs text-muted-foreground">
                  Inactive staff stay in history
                </p>
              </div>
              <Switch
                id="active"
                checked={staff.is_active}
                onCheckedChange={(v) => setStaff({ ...staff, is_active: v })}
              />
            </div>
            <div className="flex gap-2">
              <Button type="submit" disabled={loading}>
                Save
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => router.back()}
              >
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

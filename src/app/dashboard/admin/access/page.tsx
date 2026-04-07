"use client";

import { FormEvent, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";

type UserRow = { id: string; email: string; full_name: string; role: string };
type Warehouse = {
  id: string;
  code: string;
  name: string;
  is_active?: boolean;
};

export default function AdminAccessPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [selectedWarehouses, setSelectedWarehouses] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function loadInitial() {
    const [uRes, wRes] = await Promise.all([
      fetch("/api/admin/users"),
      fetch("/api/warehouses")
    ]);
    const [uJson, wJson] = await Promise.all([uRes.json(), wRes.json()]);
    if (!uRes.ok) {
      const msg = uJson?.error?.message ?? "Failed to load users";
      setError(msg);
      toast.error(msg);
      return;
    }
    if (!wRes.ok) {
      const msg = wJson?.error?.message ?? "Failed to load warehouses";
      setError(msg);
      toast.error(msg);
      return;
    }
    setError(null);
    setUsers(uJson.data ?? []);
    setWarehouses(wJson.data ?? []);
    if (uJson.data?.[0]?.id) setSelectedUserId(uJson.data[0].id);
  }

  async function loadUserAccess(userId: string) {
    const res = await fetch(`/api/admin/users/${userId}/warehouses`);
    const json = await res.json();
    if (!res.ok) {
      const msg = json?.error?.message ?? "Failed to load access";
      setError(msg);
      toast.error(msg);
      return;
    }
    setError(null);
    setSelectedWarehouses(json.data ?? []);
  }

  useEffect(() => {
    void loadInitial();
  }, []);

  useEffect(() => {
    if (selectedUserId) void loadUserAccess(selectedUserId);
  }, [selectedUserId]);

  async function onSave(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/users/${selectedUserId}/warehouses`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ warehouse_ids: selectedWarehouses })
      });
      const json = await res.json();
      if (!res.ok) {
        const msg = json?.error?.message ?? "Save failed";
        setError(msg);
        toast.error(msg);
        return;
      }
      toast.success("Warehouse access updated");
    } finally {
      setSaving(false);
    }
  }

  function toggleWarehouse(id: string) {
    setSelectedWarehouses((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Warehouse access
        </h1>
        <p className="text-sm text-muted-foreground">
          Choose which sites each user can see and use in the app.
        </p>
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Assign warehouses</CardTitle>
          <CardDescription>
            Managers only see penalties and staff for warehouses checked here.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-6" onSubmit={onSave}>
            <div className="space-y-2">
              <Label htmlFor="user">User</Label>
              <Select
                value={selectedUserId || undefined}
                onValueChange={setSelectedUserId}
                disabled={users.length === 0}
              >
                <SelectTrigger id="user">
                  <SelectValue
                    placeholder={
                      users.length === 0 ? "No users" : "Select user"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {users.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.full_name} ({u.email}) — {u.role}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-3">
              <Label>Warehouses</Label>
              <div className="space-y-3 rounded-lg border p-4">
                {warehouses.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No warehouses found. Create sites under Warehouses first.
                  </p>
                ) : (
                  warehouses.map((w) => (
                    <div key={w.id} className="flex items-center space-x-3">
                      <Checkbox
                        id={`wh-${w.id}`}
                        checked={selectedWarehouses.includes(w.id)}
                        onCheckedChange={() => toggleWarehouse(w.id)}
                      />
                      <label
                        htmlFor={`wh-${w.id}`}
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                      >
                        <span className="font-mono text-xs">{w.code}</span>
                        <span className="text-muted-foreground"> — {w.name}</span>
                        {w.is_active === false ? (
                          <span className="text-muted-foreground"> (inactive)</span>
                        ) : null}
                      </label>
                    </div>
                  ))
                )}
              </div>
            </div>

            <Button type="submit" disabled={saving || !selectedUserId}>
              {saving ? "Saving…" : "Save access"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

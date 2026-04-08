"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { StaffSearchCombobox } from "@/components/staff-search-combobox";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

type StaffRow = { id: string; full_name: string; employee_code: string };
type DefRow = {
  id: string;
  title: string;
  code?: string | null;
  default_amount?: number | null;
};

export default function ApplyPenaltyPage() {
  const [staff, setStaff] = useState<StaffRow[]>([]);
  const [defs, setDefs] = useState<DefRow[]>([]);
  const [staffId, setStaffId] = useState("");
  const [defId, setDefId] = useState("");
  const [incidentDate, setIncidentDate] = useState(() =>
    new Date().toISOString().slice(0, 10)
  );
  const [overrideAmount, setOverrideAmount] = useState("");
  const [useOverride, setUseOverride] = useState(false);
  const [notes, setNotes] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    void fetch("/api/staff")
      .then((r) => r.json())
      .then((staffJson) => {
        const list = (staffJson.data ?? []) as Record<string, unknown>[];
        setStaff(
          list.map((r) => ({
            id: String(r.id),
            full_name: String(r.full_name ?? ""),
            employee_code: String(r.employee_code ?? "")
          }))
        );
      });
  }, []);

  useEffect(() => {
    if (!staffId) {
      setDefs([]);
      setDefId("");
      return;
    }
    let cancelled = false;
    void fetch(
      `/api/penalty-definitions?staff_id=${encodeURIComponent(staffId)}`
    )
      .then((r) => r.json())
      .then((defJson) => {
        if (cancelled) return;
        const list = (defJson.data ?? []) as DefRow[];
        setDefs(list);
        setDefId((prev) => (list.some((d) => d.id === prev) ? prev : ""));
      });
    return () => {
      cancelled = true;
    };
  }, [staffId]);

  const selectedDef = useMemo(
    () => defs.find((d) => d.id === defId),
    [defs, defId]
  );

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        const form = document.getElementById("apply-penalty-form");
        if (form instanceof HTMLFormElement) form.requestSubmit();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!staffId || !defId) {
      toast.error("Select staff and penalty type");
      return;
    }
    if (useOverride && !notes.trim()) {
      toast.error("Add a note explaining the override amount");
      return;
    }
    setLoading(true);
    try {
      let proof_url: string | null = null;
      if (file) {
        const fd = new FormData();
        fd.set("file", file);
        const up = await fetch("/api/uploads/proof", {
          method: "POST",
          body: fd
        });
        const upJson = await up.json();
        if (!up.ok) {
          throw new Error(upJson.error?.message ?? "Upload failed");
        }
        proof_url = upJson.data.publicUrl;
      }

      const body: Record<string, unknown> = {
        staff_id: staffId,
        penalty_definition_id: defId,
        incident_date: incidentDate,
        notes: notes.trim() || null,
        proof_url
      };

      if (useOverride) {
        body.amount_override = true;
        body.computed_amount = Number(overrideAmount) || 0;
      }

      const res = await fetch("/api/penalty-records", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error?.message ?? "Failed");
      }
      toast.success("Penalty recorded");
      setNotes("");
      setFile(null);
      setOverrideAmount("");
      setUseOverride(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Apply penalty</h1>
        <p className="text-sm text-muted-foreground">
          Fast entry —{" "}
          <kbd className="rounded border bg-muted px-1.5 py-0.5 text-xs font-mono">
            ⌘
          </kbd>{" "}
          +{" "}
          <kbd className="rounded border bg-muted px-1.5 py-0.5 text-xs font-mono">
            Enter
          </kbd>{" "}
          to submit
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>New penalty</CardTitle>
          <CardDescription>
            Creates a record with status{" "}
            <span className="font-medium text-foreground">created</span> (open
            for settlement).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form id="apply-penalty-form" className="space-y-4" onSubmit={onSubmit}>
            <div className="space-y-2">
              <Label htmlFor="staff">Staff</Label>
              <StaffSearchCombobox
                id="staff"
                staff={staff}
                value={staffId}
                onValueChange={setStaffId}
                placeholder="Type to search, then select…"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="def">Penalty type</Label>
              <Select
                value={defId}
                onValueChange={setDefId}
                required
                disabled={!staffId}
              >
                <SelectTrigger id="def">
                  <SelectValue
                    placeholder={
                      staffId
                        ? "Select definition"
                        : "Select staff first"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {defs.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.code ? (
                        <>
                          <span className="font-mono">{d.code}</span>
                          <span className="text-muted-foreground">
                            {" "}
                            — {d.title}
                          </span>
                        </>
                      ) : (
                        d.title
                      )}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {staffId && defs.length === 0 && (
                <p className="text-xs text-amber-600 dark:text-amber-500">
                  No penalty types apply to this staff member&apos;s role. Add
                  mappings under Penalty definitions.
                </p>
              )}
              {selectedDef?.default_amount != null && !useOverride && (
                <p className="text-xs text-muted-foreground">
                  Default amount: {selectedDef.default_amount}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="date">Incident date</Label>
              <Input
                id="date"
                type="date"
                value={incidentDate}
                onChange={(e) => setIncidentDate(e.target.value)}
                required
              />
            </div>

            <div className="flex items-center justify-between rounded-lg border p-3">
              <div className="space-y-0.5">
                <Label htmlFor="override">Override amount</Label>
                <p className="text-xs text-muted-foreground">
                  Skip structure and use a fixed amount
                </p>
              </div>
              <Switch
                id="override"
                checked={useOverride}
                onCheckedChange={setUseOverride}
              />
            </div>

            {useOverride && (
              <div className="space-y-2">
                <Label htmlFor="amount">Amount</Label>
                <Input
                  id="amount"
                  type="number"
                  min={0}
                  step="0.01"
                  value={overrideAmount}
                  onChange={(e) => setOverrideAmount(e.target.value)}
                  required={useOverride}
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="proof">Proof (optional)</Label>
              <Input
                id="proof"
                type="file"
                accept="image/*,.pdf"
                className={cn("cursor-pointer")}
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">
                Notes
                {useOverride ? (
                  <span className="text-destructive"> *</span>
                ) : null}
              </Label>
              <p className="text-xs text-muted-foreground">
                {useOverride
                  ? "Required when overriding the amount — explain why."
                  : "Optional context for payroll / HR."}
              </p>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder="Context for payroll / HR…"
                required={useOverride}
              />
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Saving…" : "Record penalty"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

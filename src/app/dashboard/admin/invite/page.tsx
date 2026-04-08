"use client";

import { FormEvent, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

type Warehouse = { id: string; code: string; name: string };

function shouldShowEmailTroubleshooting(error: string | null): boolean {
  if (!error) return false;
  const lower = error.toLowerCase();
  return (
    lower.includes("smtp") ||
    lower.includes("email") ||
    lower.includes("mail") ||
    lower.includes("delivery") ||
    lower.includes("brevo")
  );
}

export default function AdminInvitePage() {
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<"manager" | "admin">("manager");
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [selectedWarehouses, setSelectedWarehouses] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    void fetch("/api/warehouses").then(async (r) => {
      const json = await r.json();
      if (r.ok) setWarehouses(json.data ?? []);
    });
  }, []);

  function toggleWarehouse(id: string) {
    setSelectedWarehouses((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/invitations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          full_name: fullName,
          role,
          warehouse_ids: selectedWarehouses
        })
      });
      const json = await res.json();
      if (!res.ok) {
        const msg = json?.error?.message ?? "Invite failed";
        setError(msg);
        toast.error(msg);
        return;
      }
      toast.success(
        `Invite queued for ${json.data?.email ?? email}. If no email arrives, check spam and Supabase → Authentication → Logs.`
      );
      setEmail("");
      setFullName("");
      setRole("manager");
      setSelectedWarehouses([]);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Invite user
        </h1>
        <p className="text-sm text-muted-foreground">
          Creates their account, assigns warehouses, and emails them a link to
          set a password and sign in.
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
          <CardTitle>New account</CardTitle>
          <CardDescription>
            <p>
              Use a unique email. Supabase sends the message (custom SMTP under
              Authentication → Emails).
            </p>
          </CardDescription>
        </CardHeader>
        <CardContent>
          {shouldShowEmailTroubleshooting(error) ? (
            <p className="mb-4 text-xs leading-relaxed text-muted-foreground">
              <strong>Brevo:</strong> In Supabase SMTP, password must be your{" "}
              <strong>SMTP key</strong> from Brevo (SMTP &amp; API → SMTP), not
              the xkeysib-… marketing API key. Username is usually your Brevo
              login email. Confirm the sender address is allowed in Brevo, then
              check <strong>Supabase Auth logs</strong> and{" "}
              <strong>Brevo transactional</strong> logs if mail never arrives.
            </p>
          ) : null}
          <form className="space-y-4" onSubmit={onSubmit}>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="name@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="fullName">Full name</Label>
              <Input
                id="fullName"
                placeholder="Full name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                autoComplete="name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="role">Role</Label>
              <Select
                value={role}
                onValueChange={(v) => setRole(v as "manager" | "admin")}
              >
                <SelectTrigger id="role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="manager">Manager</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-3">
              <Label>Warehouses</Label>
              <div className="space-y-3 rounded-lg border p-4">
                {warehouses.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No warehouses yet. Create sites under Warehouses first.
                  </p>
                ) : (
                  warehouses.map((w) => (
                    <div key={w.id} className="flex items-center space-x-3">
                      <Checkbox
                        id={`inv-${w.id}`}
                        checked={selectedWarehouses.includes(w.id)}
                        onCheckedChange={() => toggleWarehouse(w.id)}
                      />
                      <label
                        htmlFor={`inv-${w.id}`}
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                      >
                        <span className="font-mono text-xs">{w.code}</span>
                        <span className="text-muted-foreground"> — {w.name}</span>
                      </label>
                    </div>
                  ))
                )}
              </div>
            </div>

            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? "Sending invite…" : "Send invite"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

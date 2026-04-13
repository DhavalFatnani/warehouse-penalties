"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertCircle, Trash2 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";

type UserRow = {
  id: string;
  email: string;
  full_name: string;
  role: "store_manager" | "central_team_member" | "admin";
  is_active: boolean;
  created_at: string;
};

function roleLabel(role: UserRow["role"]): string {
  if (role === "store_manager") return "Store manager";
  if (role === "central_team_member") return "Central team member";
  return "Admin";
}

function roleTone(
  role: UserRow["role"]
): "default" | "secondary" | "outline" {
  if (role === "admin") return "default";
  if (role === "store_manager") return "secondary";
  return "outline";
}

type DeletionImpact = {
  penalty_records_removed: number;
  penalty_definitions_creator_cleared: number;
  staff_import_batches_uploader_cleared: number;
  penalty_attachments_uploader_cleared: number;
  audit_entries_removed: number;
  warehouse_access_rows_removed: number;
};

export default function AdminUsersPage() {
  const [rows, setRows] = useState<UserRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [removeTarget, setRemoveTarget] = useState<UserRow | null>(null);
  const [impact, setImpact] = useState<DeletionImpact | null>(null);
  const [hasAuthAccount, setHasAuthAccount] = useState(false);
  const [impactLoading, setImpactLoading] = useState(false);
  const [impactError, setImpactError] = useState<string | null>(null);
  const [confirmEmail, setConfirmEmail] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<
    "all" | "admin" | "store_manager" | "central_team_member"
  >("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">(
    "all"
  );

  async function load() {
    setError(null);
    const res = await fetch("/api/admin/users?include_inactive=true");
    const json = await res.json();
    if (!res.ok) {
      const msg = json?.error?.message ?? "Failed to load users";
      setError(msg);
      toast.error(msg);
      return;
    }
    setRows(json.data ?? []);
  }

  async function loadMe() {
    const res = await fetch("/api/me");
    const json = await res.json();
    if (res.ok && json.data?.id) {
      setCurrentUserId(json.data.id as string);
    }
  }

  useEffect(() => {
    void load();
    void loadMe();
  }, []);

  useEffect(() => {
    if (!removeTarget) {
      setImpact(null);
      setImpactError(null);
      setConfirmEmail("");
      setHasAuthAccount(false);
      return;
    }

    let cancelled = false;
    setImpactLoading(true);
    setImpactError(null);
    setConfirmEmail("");
    setImpact(null);

    void (async () => {
      const res = await fetch(`/api/admin/users/${removeTarget.id}`);
      const json = await res.json();
      if (cancelled) return;
      setImpactLoading(false);
      if (!res.ok) {
        setImpactError(json?.error?.message ?? "Failed to load removal impact");
        return;
      }
      setImpact(json.data.deletion_impact as DeletionImpact);
      setHasAuthAccount(Boolean(json.data.has_auth_account));
    })();

    return () => {
      cancelled = true;
    };
  }, [removeTarget]);

  async function patchUser(
    id: string,
    patch: Partial<Pick<UserRow, "role" | "is_active">>
  ) {
    setBusyId(id);
    try {
      const res = await fetch(`/api/admin/users/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch)
      });
      const json = await res.json();
      if (!res.ok) {
        const msg = json?.error?.message ?? "Update failed";
        setError(msg);
        toast.error(msg);
        return;
      }
      toast.success("User updated");
      await load();
    } finally {
      setBusyId(null);
    }
  }

  async function confirmRemove() {
    if (!removeTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/users/${removeTarget.id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm_email: confirmEmail.trim() })
      });
      const json = await res.json();
      if (!res.ok) {
        const msg = json?.error?.message ?? "Removal failed";
        toast.error(msg);
        return;
      }
      toast.success("User removed");
      setRemoveTarget(null);
      await load();
    } finally {
      setDeleting(false);
    }
  }

  const emailMatches =
    removeTarget != null &&
    confirmEmail.trim().toLowerCase() ===
      removeTarget.email.trim().toLowerCase();

  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((row) => {
      if (roleFilter !== "all" && row.role !== roleFilter) return false;
      if (statusFilter === "active" && !row.is_active) return false;
      if (statusFilter === "inactive" && row.is_active) return false;
      if (!q) return true;
      return [row.full_name, row.email, roleLabel(row.role)]
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }, [rows, query, roleFilter, statusFilter]);

  const metrics = useMemo(() => {
    const active = rows.filter((r) => r.is_active).length;
    const inactive = rows.length - active;
    const admins = rows.filter((r) => r.role === "admin").length;
    return { total: rows.length, active, inactive, admins };
  }, [rows]);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Users</h1>
        <p className="text-sm text-muted-foreground">
          Manage role assignment, activation status, and permanent removal from
          one place.
        </p>
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-4">
        <Card>
          <CardHeader className="pb-1">
            <CardDescription>Total users</CardDescription>
            <CardTitle className="text-2xl">{metrics.total}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-1">
            <CardDescription>Active</CardDescription>
            <CardTitle className="text-2xl">{metrics.active}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-1">
            <CardDescription>Inactive</CardDescription>
            <CardTitle className="text-2xl">{metrics.inactive}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-1">
            <CardDescription>Admins</CardDescription>
            <CardTitle className="text-2xl">{metrics.admins}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Accounts</CardTitle>
          <CardDescription>
            Store managers are single-site, central team members have full
            operational access, and admins manage users/settings.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 p-4">
          <div className="grid gap-3 sm:grid-cols-4">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search name, email, role"
              className="sm:col-span-2"
            />
            <Select
              value={roleFilter}
              onValueChange={(v) =>
                setRoleFilter(
                  v as "all" | "admin" | "store_manager" | "central_team_member"
                )
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All roles</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="store_manager">Store manager</SelectItem>
                <SelectItem value="central_team_member">
                  Central team member
                </SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={statusFilter}
              onValueChange={(v) =>
                setStatusFilter(v as "all" | "active" | "inactive")
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Quick edit</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRows.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="py-10 text-center text-muted-foreground"
                  >
                    No users match the current filters.
                  </TableCell>
                </TableRow>
              ) : (
                filteredRows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium">{row.full_name}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {row.email}
                    </TableCell>
                    <TableCell>
                      <Badge variant={roleTone(row.role)}>{roleLabel(row.role)}</Badge>
                    </TableCell>
                    <TableCell>
                      {row.is_active ? (
                        <Badge>Active</Badge>
                      ) : (
                        <Badge variant="secondary">Inactive</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Select
                          value={row.role}
                          onValueChange={(v) =>
                            patchUser(row.id, {
                              role: v as
                                | "store_manager"
                                | "central_team_member"
                                | "admin"
                            })
                          }
                          disabled={busyId === row.id}
                        >
                          <SelectTrigger className="h-8 w-[190px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="store_manager">
                              Store manager
                            </SelectItem>
                            <SelectItem value="central_team_member">
                              Central team member
                            </SelectItem>
                            <SelectItem value="admin">Admin</SelectItem>
                          </SelectContent>
                        </Select>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={busyId === row.id}
                          onClick={() =>
                            patchUser(row.id, { is_active: !row.is_active })
                          }
                        >
                          {row.is_active ? "Deactivate" : "Activate"}
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex flex-wrap justify-end gap-2">
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          className="gap-1"
                          disabled={
                            busyId === row.id ||
                            row.id === currentUserId ||
                            currentUserId === null
                          }
                          title={
                            row.id === currentUserId
                              ? "You cannot remove your own account here"
                              : undefined
                          }
                          onClick={() => setRemoveTarget(row)}
                        >
                          <Trash2 className="h-3.5 w-3.5" aria-hidden />
                          Remove
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          <p className="text-xs text-muted-foreground">
            Quick edit updates role/status instantly. Removal is permanent and
            requires explicit email confirmation.
          </p>
        </CardContent>
      </Card>

      <Dialog
        open={removeTarget != null}
        onOpenChange={(open) => {
          if (!open) setRemoveTarget(null);
        }}
      >
        <DialogContent className="max-h-[min(90vh,640px)] gap-0 overflow-y-auto p-0 sm:max-w-lg">
          <div className="p-6 pb-0">
            <DialogHeader>
              <DialogTitle className="text-destructive">
                Permanently remove user?
              </DialogTitle>
              <DialogDescription asChild>
                <div className="space-y-3 pt-1 text-left text-sm text-muted-foreground">
                  <p>
                    You are about to delete{" "}
                    <span className="font-medium text-foreground">
                      {removeTarget?.full_name}
                    </span>{" "}
                    ({removeTarget?.email}). This cannot be undone.
                  </p>
                </div>
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="space-y-4 px-6 py-4">
            <Alert variant="destructive" className="border-destructive/80">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Data and access removed</AlertTitle>
              <AlertDescription className="text-sm">
                {impactLoading ? (
                  <p>Calculating impact…</p>
                ) : impactError ? (
                  <p>{impactError}</p>
                ) : impact ? (
                  <ul className="mt-2 list-inside list-disc space-y-1.5 text-left">
                    <li>
                      <strong>Penalty records</strong> this person recorded are{" "}
                      <strong>deleted</strong> (
                      {impact.penalty_records_removed} row
                      {impact.penalty_records_removed === 1 ? "" : "s"}). Staff
                      penalty history tied only to those rows is lost.
                    </li>
                    <li>
                      <strong>Login</strong>
                      {hasAuthAccount
                        ? " is revoked — they cannot sign in again."
                        : " — this profile had no linked auth account."}
                    </li>
                    <li>
                      <strong>Warehouse access</strong> assignments are removed (
                      {impact.warehouse_access_rows_removed} row
                      {impact.warehouse_access_rows_removed === 1 ? "" : "s"}).
                    </li>
                    <li>
                      <strong>Audit log</strong> entries linked to this user are
                      deleted ({impact.audit_entries_removed} row
                      {impact.audit_entries_removed === 1 ? "" : "s"}).
                    </li>
                    <li>
                      <strong>Penalty definitions</strong> they created stay in
                      the system, but the creator reference is cleared (
                      {impact.penalty_definitions_creator_cleared} definition
                      {impact.penalty_definitions_creator_cleared === 1
                        ? ""
                        : "s"}
                      ).
                    </li>
                    <li>
                      <strong>Import batches</strong> and{" "}
                      <strong>attachments</strong> they uploaded remain, but
                      uploader references are cleared (
                      {impact.staff_import_batches_uploader_cleared} batch
                      {impact.staff_import_batches_uploader_cleared === 1
                        ? ""
                        : "es"}
                      , {impact.penalty_attachments_uploader_cleared} attachment
                      {impact.penalty_attachments_uploader_cleared === 1
                        ? ""
                        : "s"}
                      ).
                    </li>
                  </ul>
                ) : null}
              </AlertDescription>
            </Alert>

            <div className="space-y-2">
              <Label htmlFor="confirm-remove-email">
                Type the user&apos;s email to confirm
              </Label>
              <Input
                id="confirm-remove-email"
                type="email"
                autoComplete="off"
                placeholder={removeTarget?.email ?? ""}
                value={confirmEmail}
                onChange={(e) => setConfirmEmail(e.target.value)}
                disabled={impactLoading || !!impactError || !impact}
              />
            </div>
          </div>

          <DialogFooter className="gap-2 border-t bg-muted/30 p-4 sm:gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setRemoveTarget(null)}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={
                deleting ||
                !emailMatches ||
                impactLoading ||
                !!impactError ||
                !impact
              }
              onClick={() => void confirmRemove()}
            >
              {deleting ? "Removing…" : "Remove user permanently"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

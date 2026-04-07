import { NextRequest } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { adminClient } from "@/lib/supabase/admin";
import { HttpError, jsonOk, toErrorResponse } from "@/lib/http";
import {
  assertDeactivateAllowed,
  assertDeleteUserAllowed,
  assertRoleChangeAllowed
} from "@/lib/admin-guards";
import { writeAudit } from "@/lib/audit";

const patchSchema = z.object({
  role: z.enum(["manager", "admin"]).optional(),
  is_active: z.boolean().optional(),
  full_name: z.string().min(1).optional()
});

const deleteBodySchema = z.object({
  confirm_email: z.string().email()
});

const uuidParam = z.string().uuid();

async function fetchDeletionImpact(userId: string) {
  const [
    penaltyAsRecorder,
    definitionsCreated,
    importBatches,
    attachmentsUploaded,
    auditEntries,
    warehouseRows
  ] = await Promise.all([
    adminClient
      .from("penalty_records")
      .select("id", { count: "exact", head: true })
      .eq("recorded_by_user_id", userId),
    adminClient
      .from("penalty_definitions")
      .select("id", { count: "exact", head: true })
      .eq("created_by_user_id", userId),
    adminClient
      .from("staff_import_batches")
      .select("id", { count: "exact", head: true })
      .eq("uploaded_by_user_id", userId),
    adminClient
      .from("penalty_attachments")
      .select("id", { count: "exact", head: true })
      .eq("uploaded_by_user_id", userId),
    adminClient
      .from("audit_log")
      .select("id", { count: "exact", head: true })
      .or(
        `changed_by_user_id.eq.${userId},and(entity_type.eq.user,entity_id.eq.${userId})`
      ),
    adminClient
      .from("user_warehouse_access")
      .select("warehouse_id", { count: "exact", head: true })
      .eq("user_id", userId)
  ]);

  const errors = [
    penaltyAsRecorder.error,
    definitionsCreated.error,
    importBatches.error,
    attachmentsUploaded.error,
    auditEntries.error,
    warehouseRows.error
  ].filter(Boolean);
  if (errors.length > 0) {
    throw new Error(errors[0]!.message);
  }

  return {
    penalty_records_removed: penaltyAsRecorder.count ?? 0,
    penalty_definitions_creator_cleared: definitionsCreated.count ?? 0,
    staff_import_batches_uploader_cleared: importBatches.count ?? 0,
    penalty_attachments_uploader_cleared: attachmentsUploaded.count ?? 0,
    audit_entries_removed: auditEntries.count ?? 0,
    warehouse_access_rows_removed: warehouseRows.count ?? 0
  };
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requireRole(["admin"]);
    const idParsed = uuidParam.safeParse(params.id);
    if (!idParsed.success) {
      throw new HttpError("BAD_REQUEST", "Invalid user id", 400);
    }

    const { data: user, error: userError } = await adminClient
      .from("users")
      .select("id, auth_user_id, email, full_name, role, is_active, created_at")
      .eq("id", idParsed.data)
      .single();
    if (userError || !user) {
      throw new HttpError("NOT_FOUND", "User not found", 404);
    }

    const deletion_impact = await fetchDeletionImpact(user.id);

    return jsonOk({
      user,
      deletion_impact,
      has_auth_account: user.auth_user_id != null
    });
  } catch (e) {
    return toErrorResponse(e);
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { appUser } = await requireRole(["admin"]);
    const idParsed = uuidParam.safeParse(params.id);
    if (!idParsed.success) {
      throw new HttpError("BAD_REQUEST", "Invalid user id", 400);
    }
    const body = await req.json();
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) return toErrorResponse(parsed.error);

    const { data: target, error: loadError } = await adminClient
      .from("users")
      .select("id, role, is_active, full_name")
      .eq("id", idParsed.data)
      .single();
    if (loadError || !target) throw new HttpError("NOT_FOUND", "User not found", 404);

    const { count: activeAdminCount, error: countError } = await adminClient
      .from("users")
      .select("*", { count: "exact", head: true })
      .eq("role", "admin")
      .eq("is_active", true);
    if (countError) throw new Error(countError.message);

    const nextRole = parsed.data.role ?? target.role;
    const nextActive = parsed.data.is_active ?? target.is_active;

    assertRoleChangeAllowed({
      actorRole: appUser.role,
      targetRole: target.role,
      nextRole,
      activeAdminCount: activeAdminCount ?? 0,
      targetIsActive: target.is_active
    });
    assertDeactivateAllowed({
      actorRole: appUser.role,
      targetRole: target.role,
      targetIsActive: target.is_active,
      nextIsActive: nextActive,
      activeAdminCount: activeAdminCount ?? 0
    });

    const patch = {
      role: nextRole,
      is_active: nextActive,
      full_name: parsed.data.full_name ?? target.full_name
    };

    const { data, error } = await adminClient
      .from("users")
      .update(patch)
      .eq("id", idParsed.data)
      .select("id, auth_user_id, email, full_name, role, is_active, created_at")
      .single();
    if (error) throw new Error(error.message);

    await writeAudit({
      entityType: "user",
      entityId: idParsed.data,
      action: "admin_user_update",
      changedByUserId: appUser.id,
      oldValues: target,
      newValues: patch
    });

    return jsonOk(data);
  } catch (e) {
    return toErrorResponse(e);
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { appUser } = await requireRole(["admin"]);
    const idParsed = uuidParam.safeParse(params.id);
    if (!idParsed.success) {
      throw new HttpError("BAD_REQUEST", "Invalid user id", 400);
    }

    const body = await req.json();
    const parsed = deleteBodySchema.safeParse(body);
    if (!parsed.success) return toErrorResponse(parsed.error);

    const { data: target, error: loadError } = await adminClient
      .from("users")
      .select("id, auth_user_id, email, full_name, role, is_active, created_at")
      .eq("id", idParsed.data)
      .single();
    if (loadError || !target) {
      throw new HttpError("NOT_FOUND", "User not found", 404);
    }

    const confirm = parsed.data.confirm_email.trim().toLowerCase();
    if (confirm !== target.email.trim().toLowerCase()) {
      throw new HttpError(
        "CONFIRM_EMAIL_MISMATCH",
        "Email confirmation does not match this user",
        400
      );
    }

    const { count: activeAdminCount, error: countError } = await adminClient
      .from("users")
      .select("*", { count: "exact", head: true })
      .eq("role", "admin")
      .eq("is_active", true);
    if (countError) throw new Error(countError.message);

    assertDeleteUserAllowed({
      actorRole: appUser.role,
      actorUserId: appUser.id,
      targetUserId: target.id,
      targetRole: target.role,
      targetIsActive: target.is_active,
      activeAdminCount: activeAdminCount ?? 0
    });

    const authUserId = target.auth_user_id;

    const { error: prError } = await adminClient
      .from("penalty_records")
      .delete()
      .eq("recorded_by_user_id", target.id);
    if (prError) throw new Error(prError.message);

    const { error: auditByActorError } = await adminClient
      .from("audit_log")
      .delete()
      .eq("changed_by_user_id", target.id);
    if (auditByActorError) throw new Error(auditByActorError.message);

    const { error: auditEntityError } = await adminClient
      .from("audit_log")
      .delete()
      .eq("entity_type", "user")
      .eq("entity_id", target.id);
    if (auditEntityError) throw new Error(auditEntityError.message);

    const { error: delUserError } = await adminClient
      .from("users")
      .delete()
      .eq("id", target.id);
    if (delUserError) throw new Error(delUserError.message);

    if (authUserId) {
      const { error: authErr } = await adminClient.auth.admin.deleteUser(
        authUserId
      );
      if (authErr) {
        throw new HttpError(
          "AUTH_DELETE_FAILED",
          `App user was removed, but the login account could not be deleted automatically: ${authErr.message}. Remove it from the Supabase Auth dashboard if needed.`,
          502
        );
      }
    }

    await writeAudit({
      entityType: "user",
      entityId: target.id,
      action: "admin_user_delete",
      changedByUserId: appUser.id,
      oldValues: {
        email: target.email,
        full_name: target.full_name,
        role: target.role,
        is_active: target.is_active,
        had_auth_account: authUserId != null
      },
      newValues: null
    });

    return jsonOk({ ok: true, id: target.id });
  } catch (e) {
    return toErrorResponse(e);
  }
}

import { NextRequest } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { adminClient } from "@/lib/supabase/admin";
import { HttpError, jsonOk, toErrorResponse } from "@/lib/http";
import { writeAudit } from "@/lib/audit";

const schema = z.object({
  warehouse_ids: z.array(z.string().uuid())
});

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requireRole(["admin"]);
    const { data, error } = await adminClient
      .from("user_warehouse_access")
      .select("warehouse_id")
      .eq("user_id", params.id);
    if (error) throw new Error(error.message);
    return jsonOk((data ?? []).map((r) => r.warehouse_id));
  } catch (e) {
    return toErrorResponse(e);
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { appUser } = await requireRole(["admin"]);
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) return toErrorResponse(parsed.error);

    const { data: existing, error: eErr } = await adminClient
      .from("user_warehouse_access")
      .select("warehouse_id")
      .eq("user_id", params.id);
    if (eErr) throw new Error(eErr.message);

    const { data: targetUser, error: targetErr } = await adminClient
      .from("users")
      .select("id")
      .eq("id", params.id)
      .single();
    if (targetErr || !targetUser) throw new HttpError("NOT_FOUND", "User not found", 404);

    const { data: replacedCount, error: rpcError } = await adminClient.rpc(
      "replace_user_warehouse_access",
      {
        p_target_user_id: params.id,
        p_warehouse_ids: parsed.data.warehouse_ids
      }
    );
    if (rpcError) throw new Error(rpcError.message);

    await writeAudit({
      entityType: "user_warehouse_access",
      entityId: params.id,
      action: "admin_access_replace",
      changedByUserId: appUser.id,
      oldValues: { warehouse_ids: (existing ?? []).map((r) => r.warehouse_id) },
      newValues: { warehouse_ids: parsed.data.warehouse_ids }
    });

    return jsonOk({
      user_id: params.id,
      assigned_count: replacedCount ?? 0,
      warehouse_ids: parsed.data.warehouse_ids
    });
  } catch (e) {
    return toErrorResponse(e);
  }
}

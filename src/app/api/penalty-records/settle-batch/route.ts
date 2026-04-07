import { NextRequest } from "next/server";
import { adminClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/auth";
import { assertWarehouseAccess } from "@/lib/warehouse-access";
import { HttpError, jsonOk, toErrorResponse } from "@/lib/http";
import { penaltyRecordSettleSchema } from "@/lib/validators";
import { writeAudit } from "@/lib/audit";

export async function POST(req: NextRequest) {
  try {
    const { appUser } = await requireRole(["manager", "admin"]);
    const body = await req.json();
    const parsed = penaltyRecordSettleSchema.safeParse(body);
    if (!parsed.success) {
      return toErrorResponse(parsed.error);
    }

    const { data: rows, error: loadError } = await adminClient
      .from("penalty_records")
      .select("id, warehouse_id, staff_id, status")
      .in("id", parsed.data.record_ids);

    if (loadError) throw new Error(loadError.message);
    if (!rows?.length) {
      throw new HttpError("NOT_FOUND", "No matching penalty records", 404);
    }

    for (const r of rows) {
      if (r.status === "settled") {
        throw new HttpError(
          "INVALID_STATE",
          `Record ${r.id} is already settled`,
          409
        );
      }
    }

    for (const r of rows) {
      let warehouseId = r.warehouse_id;
      if (!warehouseId) {
        const { data: staff } = await adminClient
          .from("staff")
          .select("warehouse_id")
          .eq("id", r.staff_id)
          .single();
        warehouseId = staff?.warehouse_id ?? null;
      }
      if (warehouseId) {
        await assertWarehouseAccess(
          appUser.id,
          appUser.role,
          warehouseId
        );
      }
    }

    const settledAt = new Date().toISOString();
    const { data: updated, error: upErr } = await adminClient
      .from("penalty_records")
      .update({ status: "settled", settled_at: settledAt })
      .in("id", parsed.data.record_ids)
      .eq("status", "created")
      .select("id");

    if (upErr) throw new Error(upErr.message);

    await writeAudit({
      entityType: "penalty_record",
      entityId: parsed.data.record_ids[0] ?? appUser.id,
      action: "bulk_settle",
      changedByUserId: appUser.id,
      newValues: {
        record_ids: parsed.data.record_ids,
        count: updated?.length ?? 0
      }
    });

    return jsonOk({ settled_count: updated?.length ?? 0, ids: updated ?? [] });
  } catch (e) {
    return toErrorResponse(e);
  }
}

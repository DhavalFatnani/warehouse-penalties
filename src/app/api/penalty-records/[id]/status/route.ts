import { NextRequest } from "next/server";
import { adminClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/auth";
import { assertWarehouseAccess } from "@/lib/warehouse-access";
import { HttpError, jsonOk, toErrorResponse } from "@/lib/http";
import { writeAudit } from "@/lib/audit";
import { z } from "zod";

const schema = z.object({
  status: z.literal("settled")
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { appUser } = await requireRole(["manager", "admin"]);
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return toErrorResponse(parsed.error);
    }

    const { data: record, error: loadError } = await adminClient
      .from("penalty_records")
      .select("id, warehouse_id, staff_id, status")
      .eq("id", params.id)
      .single();

    if (loadError || !record) {
      throw new HttpError("NOT_FOUND", "Penalty record not found", 404);
    }

    if (record.status === "settled") {
      throw new HttpError(
        "INVALID_STATE",
        "Penalty is already settled and cannot be changed",
        409
      );
    }

    let warehouseId = record.warehouse_id;
    if (!warehouseId) {
      const { data: staff } = await adminClient
        .from("staff")
        .select("warehouse_id")
        .eq("id", record.staff_id)
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

    const { data, error } = await adminClient
      .from("penalty_records")
      .update({
        status: "settled",
        settled_at: new Date().toISOString()
      })
      .eq("id", params.id)
      .select("*")
      .single();

    if (error) throw new Error(error.message);

    await writeAudit({
      entityType: "penalty_record",
      entityId: params.id,
      action: "settle",
      changedByUserId: appUser.id,
      newValues: { status: "settled" }
    });

    return jsonOk(data);
  } catch (e) {
    return toErrorResponse(e);
  }
}

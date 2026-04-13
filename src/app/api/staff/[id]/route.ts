import { NextRequest } from "next/server";
import { adminClient } from "@/lib/supabase/admin";
import { staffPatchSchema } from "@/lib/validators";
import { requireRole } from "@/lib/auth";
import { assertWarehouseAccess } from "@/lib/warehouse-access";
import { HttpError, jsonOk, toErrorResponse } from "@/lib/http";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { appUser } = await requireRole(["manager", "admin"]);
    const { data: existing, error: loadError } = await adminClient
      .from("staff")
      .select("*")
      .eq("id", params.id)
      .single();

    if (loadError || !existing) {
      throw new HttpError("NOT_FOUND", "Staff not found", 404);
    }

    if (existing.warehouse_id) {
      await assertWarehouseAccess(
        appUser.id,
        appUser.role,
        existing.warehouse_id
      );
    }

    return jsonOk(existing);
  } catch (e) {
    return toErrorResponse(e);
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { appUser } = await requireRole(["manager", "admin"]);
    const body = await req.json();
    const parsed = staffPatchSchema.safeParse(body);
    if (!parsed.success) {
      return toErrorResponse(parsed.error);
    }

    const { data: existing, error: loadError } = await adminClient
      .from("staff")
      .select("id, warehouse_id")
      .eq("id", params.id)
      .single();

    if (loadError || !existing) {
      throw new HttpError("NOT_FOUND", "Staff not found", 404);
    }

    if (existing.warehouse_id) {
      await assertWarehouseAccess(
        appUser.id,
        appUser.role,
        existing.warehouse_id
      );
    }

    if (parsed.data.warehouse_id) {
      await assertWarehouseAccess(
        appUser.id,
        appUser.role,
        parsed.data.warehouse_id
      );
    }

    const nextWarehouseId =
      parsed.data.warehouse_id ?? existing.warehouse_id;
    if (!nextWarehouseId) {
      throw new HttpError(
        "WAREHOUSE_REQUIRED",
        "Staff must be assigned to a warehouse",
        400
      );
    }

    const { data, error } = await adminClient
      .from("staff")
      .update(parsed.data)
      .eq("id", params.id)
      .select("*")
      .single();

    if (error) throw new Error(error.message);
    return jsonOk(data);
  } catch (e) {
    return toErrorResponse(e);
  }
}

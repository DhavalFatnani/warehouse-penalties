import { NextRequest } from "next/server";
import { adminClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/auth";
import { assertWarehouseAccess } from "@/lib/warehouse-access";
import { HttpError, jsonOk, toErrorResponse } from "@/lib/http";
import { warehousePatchSchema } from "@/lib/validators";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { appUser } = await requireRole(["manager", "admin"]);
    if (appUser.role !== "admin") {
      await assertWarehouseAccess(appUser.id, appUser.role, params.id);
    }

    const { data, error } = await adminClient
      .from("warehouses")
      .select("id, code, name, is_active, created_at, updated_at")
      .eq("id", params.id)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!data) {
      throw new HttpError("NOT_FOUND", "Warehouse not found", 404);
    }
    return jsonOk(data);
  } catch (e) {
    return toErrorResponse(e);
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requireRole(["admin"]);
    const body = await req.json();
    const parsed = warehousePatchSchema.safeParse(body);
    if (!parsed.success) {
      return toErrorResponse(parsed.error);
    }

    const { data, error } = await adminClient
      .from("warehouses")
      .update(parsed.data)
      .eq("id", params.id)
      .select("id, code, name, is_active, created_at, updated_at")
      .maybeSingle();

    if (error) {
      if (error.code === "23505") {
        throw new HttpError(
          "DUPLICATE_CODE",
          "A warehouse with this code already exists",
          409
        );
      }
      throw new Error(error.message);
    }
    if (!data) {
      throw new HttpError("NOT_FOUND", "Warehouse not found", 404);
    }
    return jsonOk(data);
  } catch (e) {
    return toErrorResponse(e);
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requireRole(["admin"]);

    const { data, error } = await adminClient
      .from("warehouses")
      .delete()
      .eq("id", params.id)
      .select("id")
      .maybeSingle();

    if (error) {
      if (error.code === "23503") {
        throw new HttpError(
          "CONSTRAINT",
          "Cannot delete: data still references this warehouse. Deactivate it instead.",
          409
        );
      }
      throw new Error(error.message);
    }
    if (!data) {
      throw new HttpError("NOT_FOUND", "Warehouse not found", 404);
    }
    return jsonOk({ deleted: true, id: data.id });
  } catch (e) {
    return toErrorResponse(e);
  }
}

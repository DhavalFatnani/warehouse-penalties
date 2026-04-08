import { adminClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/auth";
import { getAccessibleWarehouseIds } from "@/lib/warehouse-access";
import { HttpError, jsonOk, toErrorResponse } from "@/lib/http";
import { warehouseCreateSchema } from "@/lib/validators";

export async function GET(req: Request) {
  try {
    const { appUser } = await requireRole(["manager", "admin"]);
    const ids = await getAccessibleWarehouseIds(appUser.id, appUser.role);
    const includeInactive =
      new URL(req.url).searchParams.get("include_inactive") === "true";

    let query = adminClient
      .from("warehouses")
      .select("id, code, name, is_active, created_at, updated_at")
      .order("code", { ascending: true });

    if (appUser.role !== "admin") {
      if (!ids.length) {
        return jsonOk([]);
      }
      query = query.in("id", ids);
    }
    if (!includeInactive) {
      query = query.eq("is_active", true);
    }

    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return jsonOk(data ?? []);
  } catch (e) {
    return toErrorResponse(e);
  }
}

export async function POST(req: Request) {
  try {
    await requireRole(["admin"]);
    const body = await req.json();
    const parsed = warehouseCreateSchema.safeParse(body);
    if (!parsed.success) {
      return toErrorResponse(parsed.error);
    }

    const { data, error } = await adminClient
      .from("warehouses")
      .insert({
        code: parsed.data.code,
        name: parsed.data.name,
        is_active: parsed.data.is_active
      })
      .select("id, code, name, is_active, created_at, updated_at")
      .single();

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
    return jsonOk(data, 201);
  } catch (e) {
    return toErrorResponse(e);
  }
}

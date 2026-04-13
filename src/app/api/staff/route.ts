import { NextRequest } from "next/server";
import { z } from "zod";
import { adminClient } from "@/lib/supabase/admin";
import { staffCreateSchema } from "@/lib/validators";
import { requireRole } from "@/lib/auth";
import {
  assertWarehouseAccess,
  getAccessibleWarehouseIds
} from "@/lib/warehouse-access";
import { HttpError, jsonOk, toErrorResponse } from "@/lib/http";

export async function GET(req: NextRequest) {
  try {
    const { appUser } = await requireRole(["manager", "admin"]);
    const search = req.nextUrl.searchParams.get("search");
    const rawActive = req.nextUrl.searchParams.get("is_active");
    const includeInactive =
      req.nextUrl.searchParams.get("include_inactive") === "true";
    const narrowWarehouseId = req.nextUrl.searchParams.get("warehouse_id");
    const staffTypeId = req.nextUrl.searchParams.get("staff_type_id");

    let query = adminClient
      .from("staff")
      .select(
        `
        id,
        employee_code,
        full_name,
        phone,
        is_active,
        warehouse_id,
        staff_type_id,
        warehouses ( code, name ),
        staff_types ( code, display_name )
      `
      )
      .order("created_at", { ascending: false });

    if (narrowWarehouseId) {
      const whParsed = z.string().uuid().safeParse(narrowWarehouseId);
      if (!whParsed.success) {
        throw new HttpError(
          "INVALID_WAREHOUSE",
          "warehouse_id must be a valid UUID",
          400
        );
      }
      await assertWarehouseAccess(
        appUser.id,
        appUser.role,
        narrowWarehouseId
      );
      query = query.eq("warehouse_id", narrowWarehouseId);
    } else if (appUser.role !== "admin") {
      const ids = await getAccessibleWarehouseIds(appUser.id, appUser.role);
      if (!ids.length) {
        return jsonOk([]);
      }
      query = query.in("warehouse_id", ids);
    }

    if (staffTypeId) {
      const stParsed = z.string().uuid().safeParse(staffTypeId);
      if (!stParsed.success) {
        throw new HttpError(
          "INVALID_STAFF_TYPE",
          "staff_type_id must be a valid UUID",
          400
        );
      }
      query = query.eq("staff_type_id", staffTypeId);
    }

    if (search) query = query.ilike("full_name", `%${search}%`);
    if (rawActive === "true") query = query.eq("is_active", true);
    else if (rawActive === "false") query = query.eq("is_active", false);
    else if (!includeInactive) query = query.eq("is_active", true);

    const { data, error } = await query.limit(500);
    if (error) throw new Error(error.message);
    return jsonOk(data ?? []);
  } catch (e) {
    return toErrorResponse(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const { appUser } = await requireRole(["manager", "admin"]);
    const body = await req.json();
    const parsed = staffCreateSchema.safeParse(body);
    if (!parsed.success) {
      return toErrorResponse(parsed.error);
    }

    await assertWarehouseAccess(
      appUser.id,
      appUser.role,
      parsed.data.warehouse_id
    );

    const { data, error } = await adminClient
      .from("staff")
      .insert(parsed.data)
      .select("*")
      .single();

    if (error) throw new Error(error.message);
    return jsonOk(data, 201);
  } catch (e) {
    return toErrorResponse(e);
  }
}

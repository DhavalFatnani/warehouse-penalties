import { NextRequest } from "next/server";
import { adminClient } from "@/lib/supabase/admin";
import { staffCreateSchema } from "@/lib/validators";
import { requireRole } from "@/lib/auth";
import {
  assertWarehouseAccess,
  getAccessibleWarehouseIds
} from "@/lib/warehouse-access";
import { jsonOk, toErrorResponse } from "@/lib/http";

export async function GET(req: NextRequest) {
  try {
    const { appUser } = await requireRole(["manager", "admin"]);
    const search = req.nextUrl.searchParams.get("search");
    const isActive = req.nextUrl.searchParams.get("is_active");

    let query = adminClient
      .from("staff")
      .select("id, employee_code, full_name, is_active, warehouse_id, staff_type_id")
      .order("created_at", { ascending: false });

    if (appUser.role !== "admin") {
      const ids = await getAccessibleWarehouseIds(appUser.id, appUser.role);
      if (!ids.length) {
        return jsonOk([]);
      }
      query = query.in("warehouse_id", ids);
    }

    if (search) query = query.ilike("full_name", `%${search}%`);
    if (isActive) query = query.eq("is_active", isActive === "true");

    const { data, error } = await query.limit(200);
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

    if (parsed.data.warehouse_id) {
      await assertWarehouseAccess(
        appUser.id,
        appUser.role,
        parsed.data.warehouse_id
      );
    }

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

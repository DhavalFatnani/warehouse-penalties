import { NextRequest } from "next/server";
import { requireRole } from "@/lib/auth";
import { adminClient } from "@/lib/supabase/admin";
import { jsonOk, toErrorResponse } from "@/lib/http";
import { penaltyCodeCreateSchema } from "@/lib/validators";
import { getAccessibleWarehouseIds, assertWarehouseAccess } from "@/lib/warehouse-access";

export async function GET(req: NextRequest) {
  try {
    const { appUser } = await requireRole(["manager", "admin"]);
    const narrowWh = req.nextUrl.searchParams.get("warehouse_id");
    const forDefWh = req.nextUrl.searchParams.get("for_definition_warehouse");
    const includeInactive =
      req.nextUrl.searchParams.get("include_inactive") === "true";

    if (narrowWh && appUser.role !== "admin") {
      await assertWarehouseAccess(appUser.id, appUser.role, narrowWh);
    }
    if (
      forDefWh &&
      forDefWh !== "global" &&
      appUser.role !== "admin"
    ) {
      await assertWarehouseAccess(appUser.id, appUser.role, forDefWh);
    }

    let q = adminClient
      .from("penalty_codes")
      .select("id, code, warehouse_id, created_at, is_active")
      .order("code", { ascending: true });

    if (!includeInactive) {
      q = q.eq("is_active", true);
    }

    if (forDefWh === "global") {
      q = q.is("warehouse_id", null);
    } else if (forDefWh) {
      q = q.or(`warehouse_id.is.null,warehouse_id.eq.${forDefWh}`);
    } else if (narrowWh) {
      q = q.or(`warehouse_id.is.null,warehouse_id.eq.${narrowWh}`);
    } else if (appUser.role !== "admin") {
      const ids = await getAccessibleWarehouseIds(appUser.id, appUser.role);
      if (ids.length === 0) {
        return jsonOk([]);
      }
      q = q.or(`warehouse_id.is.null,warehouse_id.in.(${ids.join(",")})`);
    }

    const { data, error } = await q;
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
    const parsed = penaltyCodeCreateSchema.safeParse(body);
    if (!parsed.success) return toErrorResponse(parsed.error);

    const warehouse_id = parsed.data.warehouse_id ?? null;
    if (warehouse_id) {
      await assertWarehouseAccess(appUser.id, appUser.role, warehouse_id);
    }

    const { data, error } = await adminClient
      .from("penalty_codes")
      .insert({
        code: parsed.data.code,
        warehouse_id
      })
      .select("id, code, warehouse_id, created_at, is_active")
      .single();
    if (error) throw new Error(error.message);
    return jsonOk(data, 201);
  } catch (e) {
    return toErrorResponse(e);
  }
}

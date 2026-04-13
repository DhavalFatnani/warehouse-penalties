import { NextRequest } from "next/server";
import { adminClient } from "@/lib/supabase/admin";
import { penaltyRecordCreateSchema } from "@/lib/validators";
import { requireRole } from "@/lib/auth";
import { assertWarehouseAccess } from "@/lib/warehouse-access";
import {
  fetchPenaltyViewForManager,
  getStaffIdsInAccessibleWarehouses
} from "@/lib/query-scope";
import { jsonOk, toErrorResponse } from "@/lib/http";
import { insertPenaltyRecord } from "@/lib/penalty/insert-penalty-record";

export async function GET(req: NextRequest) {
  try {
    const { appUser } = await requireRole(["manager", "admin"]);
    const sp = req.nextUrl.searchParams;
    const status = sp.get("status");
    const dateFrom = sp.get("incident_date_from");
    const dateTo = sp.get("incident_date_to");
    const staffId = sp.get("staff_id");
    const warehouseId = sp.get("warehouse_id");

    if (warehouseId) {
      await assertWarehouseAccess(appUser.id, appUser.role, warehouseId);
    }

    if (appUser.role === "admin") {
      let query = adminClient
        .from("v_penalty_records_with_staff")
        .select("*")
        .order("incident_date", { ascending: false });

      if (status) query = query.eq("status", status);
      if (dateFrom) query = query.gte("incident_date", dateFrom);
      if (dateTo) query = query.lte("incident_date", dateTo);
      if (staffId) query = query.eq("staff_id", staffId);
      if (warehouseId) query = query.eq("warehouse_id", warehouseId);

      const { data, error } = await query.limit(1000);
      if (error) throw new Error(error.message);
      return jsonOk(data ?? []);
    }

    const { warehouseIds, staffIds } =
      await getStaffIdsInAccessibleWarehouses(appUser.id, appUser.role);

    if (!warehouseIds.length || !staffIds?.length) {
      return jsonOk([]);
    }

    const merged = await fetchPenaltyViewForManager(
      warehouseIds,
      staffIds,
      warehouseId,
      (q) => {
        let x = q.order("incident_date", { ascending: false });
        if (status) x = x.eq("status", status);
        if (dateFrom) x = x.gte("incident_date", dateFrom);
        if (dateTo) x = x.lte("incident_date", dateTo);
        if (staffId) x = x.eq("staff_id", staffId);
        return x.limit(1000);
      }
    );

    merged.sort((a, b) =>
      String(b.incident_date ?? "").localeCompare(String(a.incident_date ?? ""))
    );
    return jsonOk(merged);
  } catch (e) {
    return toErrorResponse(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const { appUser } = await requireRole(["manager", "admin"]);
    const body = await req.json();
    const parsed = penaltyRecordCreateSchema.safeParse(body);
    if (!parsed.success) {
      return toErrorResponse(parsed.error);
    }

    const data = await insertPenaltyRecord(appUser, parsed.data);
    return jsonOk(data, 201);
  } catch (e) {
    return toErrorResponse(e);
  }
}

import { NextRequest } from "next/server";
import { adminClient } from "@/lib/supabase/admin";
import { penaltyRecordCreateSchema } from "@/lib/validators";
import { requireRole } from "@/lib/auth";
import { assertWarehouseAccess } from "@/lib/warehouse-access";
import {
  fetchPenaltyViewForManager,
  getStaffIdsInAccessibleWarehouses
} from "@/lib/query-scope";
import { HttpError, jsonOk, toErrorResponse } from "@/lib/http";
import { computePenaltyPayload } from "@/lib/penalty/apply-server";
import { assertPenaltyAppliesToStaffType } from "@/lib/penalty-definition-staff-types";

export async function GET(req: NextRequest) {
  try {
    const { appUser } = await requireRole(["manager", "admin"]);
    const sp = req.nextUrl.searchParams;
    const status = sp.get("status");
    const dateFrom = sp.get("incident_date_from");
    const dateTo = sp.get("incident_date_to");
    const staffId = sp.get("staff_id");
    const warehouseId = sp.get("warehouse_id");

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

    const { data: staffRow, error: staffErr } = await adminClient
      .from("staff")
      .select("warehouse_id")
      .eq("id", parsed.data.staff_id)
      .single();

    if (staffErr || !staffRow) {
      throw new Error("Staff not found");
    }

    if (
      parsed.data.warehouse_id &&
      parsed.data.warehouse_id !== staffRow.warehouse_id
    ) {
      throw new HttpError(
        "WAREHOUSE_MISMATCH",
        "Penalty warehouse must match the selected staff member's warehouse.",
        400
      );
    }

    const { staffWarehouseId } = await assertPenaltyAppliesToStaffType(
      parsed.data.staff_id,
      parsed.data.penalty_definition_id
    );

    const whId = staffWarehouseId ?? null;
    if (whId) {
      await assertWarehouseAccess(appUser.id, appUser.role, whId);
    }

    const computed = await computePenaltyPayload(adminClient, {
      staff_id: parsed.data.staff_id,
      penalty_definition_id: parsed.data.penalty_definition_id,
      incident_date: parsed.data.incident_date,
      computed_amount: parsed.data.computed_amount,
      manual_override: parsed.data.manual_override,
      amount_override: parsed.data.amount_override
    });

    const insertRow = {
      staff_id: parsed.data.staff_id,
      penalty_definition_id: parsed.data.penalty_definition_id,
      warehouse_id: whId,
      incident_date: parsed.data.incident_date,
      recorded_by_user_id: appUser.id,
      occurrence_index: computed.occurrence_index,
      computed_amount: computed.computed_amount,
      computed_points: computed.computed_points,
      structure_snapshot: computed.structure_snapshot,
      manual_override: computed.manual_override,
      notes: parsed.data.notes?.trim() ? parsed.data.notes.trim() : null,
      proof_url: parsed.data.proof_url ?? null,
      status: "created" as const
    };

    if (
      insertRow.computed_amount == null &&
      insertRow.computed_points == null
    ) {
      throw new HttpError(
        "INVALID_AMOUNT",
        "Could not determine penalty amount; set an override amount or fix the definition.",
        400
      );
    }

    const { data, error } = await adminClient
      .from("penalty_records")
      .insert(insertRow)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return jsonOk(data, 201);
  } catch (e) {
    return toErrorResponse(e);
  }
}

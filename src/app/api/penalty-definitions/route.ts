import { NextRequest } from "next/server";
import { adminClient } from "@/lib/supabase/admin";
import { penaltyDefinitionSchema } from "@/lib/validators";
import { requireRole } from "@/lib/auth";
import { jsonOk, toErrorResponse } from "@/lib/http";
import {
  insertPenaltyDefinitionWithStaffTypes,
  normalizePenaltyDefinition,
  PENALTY_DEFINITION_SELECT
} from "@/lib/penalty-definitions-api";
import {
  assertPenaltyCodeActiveForUse,
  assertPenaltyCodeMatchesDefinitionWarehouse,
  fetchPenaltyCodeWarehouse
} from "@/lib/penalty-code-guards";
import { assertWarehouseAccess, getAccessibleWarehouseIds } from "@/lib/warehouse-access";

export async function GET(req: NextRequest) {
  try {
    const { appUser } = await requireRole(["manager", "admin"]);
    const staffId = req.nextUrl.searchParams.get("staff_id");
    const listWarehouseId = req.nextUrl.searchParams.get("warehouse_id");
    const globalsOnly = req.nextUrl.searchParams.get("globals_only") === "1";

    if (listWarehouseId && appUser.role !== "admin") {
      await assertWarehouseAccess(appUser.id, appUser.role, listWarehouseId);
    }

    let query = adminClient
      .from("penalty_definitions")
      .select(PENALTY_DEFINITION_SELECT)
      .order("created_at", { ascending: false });

    if (staffId) {
      const { data: st, error: stErr } = await adminClient
        .from("staff")
        .select("staff_type_id, warehouse_id, is_active")
        .eq("id", staffId)
        .maybeSingle();
      if (stErr) throw new Error(stErr.message);
      if (!st || !st.is_active) {
        return jsonOk([]);
      }

      const { data: links, error: linkErr } = await adminClient
        .from("penalty_definition_staff_types")
        .select("penalty_definition_id")
        .eq("staff_type_id", st.staff_type_id);
      if (linkErr) throw new Error(linkErr.message);
      const defIds = [
        ...new Set((links ?? []).map((l) => l.penalty_definition_id as string))
      ];
      if (defIds.length === 0) {
        return jsonOk([]);
      }
      query = query.in("id", defIds).eq("is_active", true);
      const wh = st.warehouse_id as string | null;
      if (wh) {
        query = query.or(`warehouse_id.is.null,warehouse_id.eq.${wh}`);
      } else {
        query = query.is("warehouse_id", null);
      }
    } else {
      if (globalsOnly) {
        query = query.is("warehouse_id", null);
      } else if (listWarehouseId) {
        query = query.or(
          `warehouse_id.is.null,warehouse_id.eq.${listWarehouseId}`
        );
      } else if (appUser.role !== "admin") {
        const ids = await getAccessibleWarehouseIds(appUser.id, appUser.role);
        if (ids.length === 0) {
          return jsonOk([]);
        }
        query = query.or(
          `warehouse_id.is.null,warehouse_id.in.(${ids.join(",")})`
        );
      }
    }

    const { data, error } = await query;
    if (error) throw new Error(error.message);
    const rows = (data ?? []).map((r) =>
      normalizePenaltyDefinition(r as Record<string, unknown>)
    );
    return jsonOk(rows);
  } catch (e) {
    return toErrorResponse(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const { appUser } = await requireRole(["manager", "admin"]);
    const body = await req.json();
    const parsed = penaltyDefinitionSchema.safeParse(body);
    if (!parsed.success) {
      return toErrorResponse(parsed.error);
    }

    const warehouse_id = parsed.data.warehouse_id ?? null;
    if (warehouse_id) {
      await assertWarehouseAccess(appUser.id, appUser.role, warehouse_id);
    }

    const codeRow = await fetchPenaltyCodeWarehouse(
      adminClient,
      parsed.data.penalty_code_id
    );
    assertPenaltyCodeActiveForUse(codeRow);
    assertPenaltyCodeMatchesDefinitionWarehouse(
      codeRow.warehouse_id,
      warehouse_id
    );

    const { staff_type_ids, ...fields } = parsed.data;
    const row = {
      ...fields,
      warehouse_id
    };
    if (
      row.structure_model === "fixed_per_occurrence" &&
      row.default_amount != null
    ) {
      row.structure_config = {
        ...(row.structure_config ?? {}),
        amount: row.default_amount
      };
    }

    const created = await insertPenaltyDefinitionWithStaffTypes(
      adminClient,
      row as Record<string, unknown>,
      staff_type_ids,
      appUser.id
    );
    return jsonOk(created, 201);
  } catch (e) {
    return toErrorResponse(e);
  }
}

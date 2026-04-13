import { NextRequest } from "next/server";
import { adminClient } from "@/lib/supabase/admin";
import { penaltyDefinitionSchema } from "@/lib/validators";
import { requireRole } from "@/lib/auth";
import { HttpError, jsonOk, toErrorResponse } from "@/lib/http";
import { replacePenaltyDefinitionStaffTypes } from "@/lib/penalty-definition-staff-types";
import {
  normalizePenaltyDefinition,
  PENALTY_DEFINITION_SELECT
} from "@/lib/penalty-definitions-api";
import {
  assertPenaltyCodeActiveForUse,
  assertPenaltyCodeMatchesDefinitionWarehouse,
  fetchPenaltyCodeWarehouse
} from "@/lib/penalty-code-guards";
import { assertWarehouseAccess } from "@/lib/warehouse-access";
import { z } from "zod";
import { assertCatalogAccessAllowed } from "@/lib/roles";

const patchSchema = penaltyDefinitionSchema
  .partial()
  .merge(
    z.object({
      staff_type_ids: z.array(z.string().uuid()).min(1).optional()
    })
  );

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { appUser } = await requireRole(["manager", "admin"]);
    assertCatalogAccessAllowed(appUser.role);
    const body = await req.json();
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      return toErrorResponse(parsed.error);
    }

    const { staff_type_ids, ...patch } = parsed.data;
    const hasDefFields = Object.keys(patch).length > 0;

    const { data: cur, error: curErr } = await adminClient
      .from("penalty_definitions")
      .select("warehouse_id, penalty_code_id")
      .eq("id", params.id)
      .single();
    if (curErr || !cur) {
      throw new HttpError("NOT_FOUND", "Penalty definition not found", 404);
    }

    if (patch.warehouse_id !== undefined && patch.warehouse_id) {
      await assertWarehouseAccess(
        appUser.id,
        appUser.role,
        patch.warehouse_id
      );
    }

    if (
      patch.penalty_code_id !== undefined ||
      patch.warehouse_id !== undefined
    ) {
      const mergedWh =
        patch.warehouse_id !== undefined
          ? patch.warehouse_id
          : (cur.warehouse_id as string | null);
      const mergedCodeId =
        patch.penalty_code_id !== undefined
          ? patch.penalty_code_id
          : (cur.penalty_code_id as string);
      const cw = await fetchPenaltyCodeWarehouse(adminClient, mergedCodeId);
      const codeChanging =
        patch.penalty_code_id !== undefined &&
        patch.penalty_code_id !== cur.penalty_code_id;
      if (codeChanging) {
        assertPenaltyCodeActiveForUse(cw);
      }
      assertPenaltyCodeMatchesDefinitionWarehouse(cw.warehouse_id, mergedWh);
    }

    if (hasDefFields) {
      const { error } = await adminClient
        .from("penalty_definitions")
        .update(patch)
        .eq("id", params.id);
      if (error) throw new Error(error.message);
    }

    if (staff_type_ids) {
      await replacePenaltyDefinitionStaffTypes(
        adminClient,
        params.id,
        staff_type_ids
      );
    }

    const { data: full, error: fullErr } = await adminClient
      .from("penalty_definitions")
      .select(PENALTY_DEFINITION_SELECT)
      .eq("id", params.id)
      .single();
    if (fullErr) throw new Error(fullErr.message);

    return jsonOk(
      normalizePenaltyDefinition(full as Record<string, unknown>)
    );
  } catch (e) {
    return toErrorResponse(e);
  }
}

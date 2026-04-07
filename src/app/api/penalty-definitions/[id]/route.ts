import { NextRequest } from "next/server";
import { adminClient } from "@/lib/supabase/admin";
import { penaltyDefinitionSchema } from "@/lib/validators";
import { requireRole } from "@/lib/auth";
import { jsonOk, toErrorResponse } from "@/lib/http";
import { replacePenaltyDefinitionStaffTypes } from "@/lib/penalty-definition-staff-types";
import {
  normalizePenaltyDefinition,
  PENALTY_DEFINITION_SELECT
} from "@/lib/penalty-definitions-api";
import { z } from "zod";

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
    await requireRole(["manager", "admin"]);
    const body = await req.json();
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      return toErrorResponse(parsed.error);
    }

    const { staff_type_ids, ...patch } = parsed.data;
    const hasDefFields = Object.keys(patch).length > 0;

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

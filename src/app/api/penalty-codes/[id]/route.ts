import { NextRequest } from "next/server";
import { requireRole } from "@/lib/auth";
import { adminClient } from "@/lib/supabase/admin";
import { HttpError, jsonOk, toErrorResponse } from "@/lib/http";
import { penaltyCodePatchSchema } from "@/lib/validators";
import { assertWarehouseAccess } from "@/lib/warehouse-access";
import {
  normalizePenaltyCodeRow,
  PENALTY_CODE_SELECT
} from "@/lib/penalty-code-row";
import { assertCatalogAccessAllowed } from "@/lib/roles";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { appUser } = await requireRole(["manager", "admin"]);
    assertCatalogAccessAllowed(appUser.role);
    const body = await req.json();
    const parsed = penaltyCodePatchSchema.safeParse(body);
    if (!parsed.success) return toErrorResponse(parsed.error);

    const { data: row, error: loadErr } = await adminClient
      .from("penalty_codes")
      .select("id, warehouse_id")
      .eq("id", params.id)
      .single();

    if (loadErr || !row) {
      throw new HttpError("NOT_FOUND", "Penalty code not found", 404);
    }

    const whId = row.warehouse_id as string | null;
    if (whId) {
      await assertWarehouseAccess(appUser.id, appUser.role, whId);
    }

    const { data, error } = await adminClient
      .from("penalty_codes")
      .update({ is_active: parsed.data.is_active })
      .eq("id", params.id)
      .select(PENALTY_CODE_SELECT)
      .single();

    if (error) throw new Error(error.message);
    return jsonOk(normalizePenaltyCodeRow(data as Record<string, unknown>));
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

    const { data: codeRow, error: codeErr } = await adminClient
      .from("penalty_codes")
      .select("id")
      .eq("id", params.id)
      .maybeSingle();
    if (codeErr) throw new Error(codeErr.message);
    if (!codeRow) {
      throw new HttpError("NOT_FOUND", "Penalty code not found", 404);
    }

    const { count: definitionCount, error: defErr } = await adminClient
      .from("penalty_definitions")
      .select("id", { count: "exact", head: true })
      .eq("penalty_code_id", params.id);
    if (defErr) throw new Error(defErr.message);
    if ((definitionCount ?? 0) > 0) {
      throw new HttpError(
        "CONFLICT",
        "Cannot delete code that is used by existing definitions",
        409
      );
    }

    const { error: delErr } = await adminClient
      .from("penalty_codes")
      .delete()
      .eq("id", params.id);
    if (delErr) throw new Error(delErr.message);

    return jsonOk({ id: params.id, deleted: true });
  } catch (e) {
    return toErrorResponse(e);
  }
}

import { NextRequest } from "next/server";
import { adminClient } from "@/lib/supabase/admin";
import { importBatchCreateSchema } from "@/lib/validators";
import { requireRole } from "@/lib/auth";
import { assertWarehouseAccess } from "@/lib/warehouse-access";
import { jsonOk, toErrorResponse } from "@/lib/http";

export async function GET() {
  try {
    await requireRole(["manager", "admin"]);
    const { data, error } = await adminClient
      .from("staff_import_batches")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);
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
    const parsed = importBatchCreateSchema.safeParse(body);
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

    const { data: batch, error: batchError } = await adminClient
      .from("staff_import_batches")
      .insert({
        source_filename: parsed.data.source_filename,
        uploaded_by_user_id: appUser.id,
        warehouse_id: parsed.data.warehouse_id ?? null,
        status: "pending",
        total_rows: 0
      })
      .select("*")
      .single();

    if (batchError) throw new Error(batchError.message);
    return jsonOk(batch, 201);
  } catch (e) {
    return toErrorResponse(e);
  }
}


import { NextRequest } from "next/server";
import Papa from "papaparse";
import { adminClient } from "@/lib/supabase/admin";
import {
  importBatchCreateSchema,
  importCommitSchema
} from "@/lib/validators";
import { requireRole } from "@/lib/auth";
import { assertWarehouseAccess } from "@/lib/warehouse-access";
import { HttpError, jsonOk, toErrorResponse } from "@/lib/http";

type CsvRow = Record<string, string>;

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

export async function PUT(req: NextRequest) {
  try {
    const { appUser } = await requireRole(["manager", "admin"]);
    const body = await req.json();
    const parsed = importCommitSchema.safeParse(body);
    if (!parsed.success) {
      return toErrorResponse(parsed.error);
    }

    await assertWarehouseAccess(
      appUser.id,
      appUser.role,
      parsed.data.warehouse_id
    );

    const csvParsed = Papa.parse<CsvRow>(parsed.data.csv, {
      header: true,
      skipEmptyLines: true
    });

    if (csvParsed.errors.length) {
      throw new HttpError(
        "CSV_PARSE_ERROR",
        "Failed to parse CSV",
        400,
        csvParsed.errors
      );
    }

    const { data: staffTypes, error: stErr } = await adminClient
      .from("staff_types")
      .select("code");
    if (stErr) throw new Error(stErr.message);
    const typeSet = new Set((staffTypes ?? []).map((t) => t.code.toUpperCase()));

    const defaultType = (
      parsed.data.default_staff_type_code ?? "PP"
    ).toUpperCase();

    const pRows = csvParsed.data.map((row, i) => {
      const employee_code = row.employee_code?.trim();
      const full_name = row.full_name?.trim();
      const rawType = row.staff_type_code?.trim();
      const typeCode = (rawType || defaultType).toUpperCase();

      const fieldErrors: { field: string; message: string }[] = [];
      if (!employee_code) {
        fieldErrors.push({ field: "employee_code", message: "Required" });
      }
      if (!full_name) {
        fieldErrors.push({ field: "full_name", message: "Required" });
      }
      if (!typeSet.has(typeCode)) {
        fieldErrors.push({
          field: "staff_type_code",
          message: `Unknown staff type: ${typeCode}`
        });
      }

      const validation_status = fieldErrors.length === 0 ? "valid" : "invalid";
      return {
        row_number: i + 1,
        raw: { ...row, staff_type_code: rawType || defaultType },
        validation_status,
        validation_errors:
          fieldErrors.length === 0
            ? null
            : { fields: fieldErrors.map((f) => f.field), messages: fieldErrors }
      };
    });

    const { data: rpcResult, error: rpcError } = await adminClient.rpc(
      "commit_staff_import_batch",
      {
        p_batch_id: parsed.data.batch_id,
        p_warehouse_id: parsed.data.warehouse_id,
        p_rows: pRows,
        p_default_staff_type: defaultType
      }
    );

    if (rpcError) throw new Error(rpcError.message);

    return jsonOk({
      summary: rpcResult as Record<string, unknown>,
      preview: pRows.slice(0, 25)
    });
  } catch (e) {
    return toErrorResponse(e);
  }
}

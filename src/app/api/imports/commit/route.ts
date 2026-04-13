import { NextRequest } from "next/server";
import Papa from "papaparse";
import { adminClient } from "@/lib/supabase/admin";
import { importCommitSchema } from "@/lib/validators";
import { requireRole } from "@/lib/auth";
import {
  assertWarehouseAccess,
  getAccessibleWarehouseIds
} from "@/lib/warehouse-access";
import { resolveWarehouseForImportRow } from "@/lib/csv-warehouse";
import { HttpError, jsonOk, toErrorResponse } from "@/lib/http";

type CsvRow = Record<string, string>;

export async function POST(req: NextRequest) {
  try {
    const { appUser } = await requireRole(["manager", "admin"]);
    const body = await req.json();
    const parsed = importCommitSchema.safeParse(body);
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

    const accessibleIds = await getAccessibleWarehouseIds(
      appUser.id,
      appUser.role
    );
    const accessibleSet = new Set(accessibleIds);
    const codeToId = new Map<string, string>();
    if (accessibleIds.length > 0) {
      const { data: whRows, error: whErr } = await adminClient
        .from("warehouses")
        .select("id, code")
        .in("id", accessibleIds);
      if (whErr) throw new Error(whErr.message);
      for (const w of whRows ?? []) {
        codeToId.set(
          String(w.code ?? "")
            .trim()
            .toUpperCase(),
          w.id as string
        );
      }
    }

    const csvParsed = Papa.parse<CsvRow>(parsed.data.csv, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.replace(/^\ufeff/, "").trim().toLowerCase()
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

    const pRows = csvParsed.data.map((row, i) => {
      const employee_code = row.employee_code?.trim();
      const full_name = row.full_name?.trim();
      const rawType = row.staff_type_code?.trim() ?? "";
      const typeCode = rawType ? rawType.toUpperCase() : "";

      const fieldErrors: { field: string; message: string }[] = [];
      if (!employee_code) {
        fieldErrors.push({ field: "employee_code", message: "Required" });
      }
      if (!full_name) {
        fieldErrors.push({ field: "full_name", message: "Required" });
      }
      if (!rawType) {
        fieldErrors.push({ field: "staff_type_code", message: "Required" });
      } else if (!typeSet.has(typeCode)) {
        fieldErrors.push({
          field: "staff_type_code",
          message: `Unknown staff type: ${typeCode}`
        });
      }

      const whResolved = resolveWarehouseForImportRow({
        row,
        defaultWarehouseId: parsed.data.warehouse_id ?? null,
        codeToId,
        accessibleIds: accessibleSet
      });
      if (!whResolved.ok) {
        fieldErrors.push({ field: "warehouse", message: whResolved.message });
      }

      const validation_status = fieldErrors.length === 0 ? "valid" : "invalid";
      return {
        row_number: i + 1,
        warehouse_id: whResolved.ok ? whResolved.warehouse_id : null,
        raw: { ...row, staff_type_code: rawType },
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
        p_warehouse_id: parsed.data.warehouse_id ?? null,
        p_rows: pRows
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

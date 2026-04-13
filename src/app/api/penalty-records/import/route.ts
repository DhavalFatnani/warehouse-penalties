import { NextRequest } from "next/server";
import { requireRole } from "@/lib/auth";
import { adminClient } from "@/lib/supabase/admin";
import { HttpError, jsonOk, toErrorResponse } from "@/lib/http";
import {
  penaltyRecordCreateSchema,
  penaltyRecordImportSchema
} from "@/lib/validators";
import { assertWarehouseAccess } from "@/lib/warehouse-access";
import { insertPenaltyRecord } from "@/lib/penalty/insert-penalty-record";
import { parsePenaltyImportCsv } from "@/lib/penalty/penalty-csv-parse";

type ImportResult = {
  row_number: number;
  status: "created" | "error";
  record_id?: string;
  message?: string;
};

const MAX_ROWS = 200;

export async function POST(req: NextRequest) {
  try {
    const { appUser } = await requireRole(["manager", "admin"]);
    const body = await req.json();
    const parsed = penaltyRecordImportSchema.safeParse(body);
    if (!parsed.success) return toErrorResponse(parsed.error);

    const warehouseId = parsed.data.warehouse_id;
    if (!warehouseId) {
      throw new HttpError(
        "WAREHOUSE_REQUIRED",
        "Select a site before importing penalty records.",
        400
      );
    }

    await assertWarehouseAccess(appUser.id, appUser.role, warehouseId);

    const csvParsed = parsePenaltyImportCsv(parsed.data.csv);
    if (csvParsed.errors.length > 0) {
      throw new HttpError(
        "CSV_PARSE_ERROR",
        csvParsed.errors[0]?.message ?? "Failed to parse CSV",
        400,
        csvParsed.errors
      );
    }

    const rows = csvParsed.data;
    if (rows.length === 0) {
      throw new HttpError("EMPTY_CSV", "No data rows found in CSV.", 400);
    }
    if (rows.length > MAX_ROWS) {
      throw new HttpError(
        "TOO_MANY_ROWS",
        `At most ${MAX_ROWS} rows are allowed per import.`,
        400
      );
    }

    const { data: staffRows, error: staffErr } = await adminClient
      .from("staff")
      .select("id, employee_code")
      .eq("warehouse_id", warehouseId)
      .eq("is_active", true);
    if (staffErr) throw new Error(staffErr.message);

    const staffByEmployeeCode = new Map<string, string>();
    for (const s of staffRows ?? []) {
      const key = String(s.employee_code ?? "").trim().toUpperCase();
      if (!key) continue;
      staffByEmployeeCode.set(key, String(s.id));
    }

    const results: ImportResult[] = [];
    let created = 0;
    let failed = 0;

    for (let idx = 0; idx < rows.length; idx++) {
      const row = rows[idx] ?? {};
      const row_number = idx + 1;
      const employeeCode = String(row.employee_code ?? "")
        .trim()
        .toUpperCase();
      const penaltyDefinitionId = String(row.penalty_definition_id ?? "").trim();
      const incidentDate = String(row.incident_date ?? "").trim();
      const notes = String(row.notes ?? "").trim();
      const overrideAmountRaw = String(row.override_amount ?? "").trim();

      if (!employeeCode || !penaltyDefinitionId || !incidentDate) {
        failed += 1;
        results.push({
          row_number,
          status: "error",
          message:
            "Required columns: employee_code, penalty_definition_id, incident_date"
        });
        continue;
      }

      const staffId = staffByEmployeeCode.get(employeeCode);
      if (!staffId) {
        failed += 1;
        results.push({
          row_number,
          status: "error",
          message: `Unknown employee_code "${employeeCode}" for selected site`
        });
        continue;
      }

      const payload: Record<string, unknown> = {
        staff_id: staffId,
        penalty_definition_id: penaltyDefinitionId,
        warehouse_id: warehouseId,
        incident_date: incidentDate,
        notes: notes || null,
        proof_url: null
      };

      if (overrideAmountRaw) {
        const amount = Number(overrideAmountRaw);
        if (!Number.isFinite(amount)) {
          failed += 1;
          results.push({
            row_number,
            status: "error",
            message: "override_amount must be a valid number"
          });
          continue;
        }
        payload.amount_override = true;
        payload.computed_amount = amount;
      }

      const zodParsed = penaltyRecordCreateSchema.safeParse(payload);
      if (!zodParsed.success) {
        failed += 1;
        results.push({
          row_number,
          status: "error",
          message: zodParsed.error.issues.map((x) => x.message).join("; ")
        });
        continue;
      }

      try {
        const createdRow = await insertPenaltyRecord(appUser, zodParsed.data);
        created += 1;
        results.push({
          row_number,
          status: "created",
          record_id: String(createdRow.id)
        });
      } catch (e) {
        failed += 1;
        results.push({
          row_number,
          status: "error",
          message: e instanceof Error ? e.message : "Unexpected error"
        });
      }
    }

    return jsonOk({
      summary: {
        total_rows: rows.length,
        created,
        failed
      },
      results
    });
  } catch (e) {
    return toErrorResponse(e);
  }
}

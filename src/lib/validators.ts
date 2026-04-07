import { z } from "zod";

export const warehouseCreateSchema = z.object({
  code: z
    .string()
    .min(1)
    .max(64)
    .transform((s) => s.trim().toUpperCase()),
  name: z.string().min(1).max(256).transform((s) => s.trim()),
  is_active: z.boolean().optional().default(true)
});

export const warehousePatchSchema = z
  .object({
    code: z
      .string()
      .min(1)
      .max(64)
      .transform((s) => s.trim().toUpperCase())
      .optional(),
    name: z
      .string()
      .min(1)
      .max(256)
      .transform((s) => s.trim())
      .optional(),
    is_active: z.boolean().optional()
  })
  .refine((d) => Object.keys(d).length > 0, "No fields to update");

export const staffCreateSchema = z.object({
  warehouse_id: z.string().uuid().nullable().optional(),
  staff_type_id: z.string().uuid(),
  employee_code: z.string().min(1),
  full_name: z.string().min(1),
  external_ref: z.string().optional().nullable()
});

export const staffActiveSchema = z.object({
  is_active: z.boolean()
});

export const staffPatchSchema = z
  .object({
    full_name: z.string().min(1).optional(),
    employee_code: z.string().min(1).optional(),
    warehouse_id: z.string().uuid().nullable().optional(),
    staff_type_id: z.string().uuid().optional(),
    is_active: z.boolean().optional()
  })
  .refine((d) => Object.keys(d).length > 0, "No fields to update");

export const penaltyDefinitionSchema = z.object({
  code: z.string().min(2),
  title: z.string().min(2),
  description: z.string().optional().nullable(),
  category: z.string().min(1).optional().nullable(),
  severity: z.number().int().min(1).max(5).nullable().optional(),
  default_amount: z.number().nonnegative().nullable().optional(),
  structure_model: z.enum([
    "fixed_per_occurrence",
    "tiered_per_occurrence",
    "linear_escalation",
    "bracket_cumulative"
  ]),
  occurrence_scope: z.enum([
    "all_time",
    "rolling_window",
    "calendar_month",
    "calendar_quarter"
  ]),
  structure_config: z.record(z.unknown()).optional().nullable(),
  /** Which staff role types (PP, IE, ASM, Rider, …) this penalty applies to */
  staff_type_ids: z.array(z.string().uuid()).min(1, "Select at least one staff type")
});

export const penaltyRecordCreateSchema = z
  .object({
    staff_id: z.string().uuid(),
    penalty_definition_id: z.string().uuid(),
    warehouse_id: z.string().uuid().nullable().optional(),
    incident_date: z.string().min(1),
    computed_amount: z.number().nullable().optional(),
    computed_points: z.number().int().nullable().optional(),
    occurrence_index: z.number().int().positive().nullable().optional(),
    structure_snapshot: z.record(z.unknown()).nullable().optional(),
    notes: z.string().optional().nullable(),
    proof_url: z.string().optional().nullable(),
    manual_override: z.boolean().optional(),
    /** When true, skip structure-based amount calculation (uses computed_amount only). */
    amount_override: z.boolean().optional()
  })
  .superRefine((data, ctx) => {
    const override =
      data.amount_override === true || data.manual_override === true;
    if (!override) return;
    const t =
      typeof data.notes === "string" ? data.notes.trim() : "";
    if (!t) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Notes are required when override amount is enabled",
        path: ["notes"]
      });
    }
  });

export const penaltyRecordSettleSchema = z.object({
  record_ids: z.array(z.string().uuid()).min(1)
});

export const importBatchCreateSchema = z.object({
  source_filename: z.string().min(1),
  warehouse_id: z.string().uuid()
});

export const importCommitSchema = z.object({
  batch_id: z.string().uuid(),
  csv: z.string().min(1),
  warehouse_id: z.string().uuid(),
  default_staff_type_code: z.string().min(1).max(32).optional()
});

export const settlementPreviewQuerySchema = z.object({
  incident_date_from: z.string().optional(),
  incident_date_to: z.string().optional(),
  warehouse_id: z.string().uuid().optional(),
  staff_id: z.string().uuid().optional(),
  staff_type_id: z.string().uuid().optional(),
  group_by: z.enum(["staff", "staff_type", "warehouse"]).optional()
});

/** @deprecated use penaltyRecordCreateSchema */
export const penaltyRecordSchema = penaltyRecordCreateSchema;

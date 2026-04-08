import { z } from "zod";

/** Optional phone: trim; empty string → null; omit key stays undefined (PATCH). */
const optionalTrimmedPhone = z.preprocess((v) => {
  if (v === undefined) return undefined;
  if (v === null) return null;
  if (typeof v === "string") {
    const t = v.trim();
    return t === "" ? null : t;
  }
  return v;
}, z.string().max(40).nullable().optional());

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
  external_ref: z.string().optional().nullable(),
  phone: optionalTrimmedPhone
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
    is_active: z.boolean().optional(),
    phone: optionalTrimmedPhone
  })
  .refine((d) => Object.keys(d).length > 0, "No fields to update");

export const penaltyCodeCreateSchema = z.object({
  code: z
    .string()
    .min(1)
    .max(64)
    .transform((s) => s.trim().replace(/\s+/g, "").toUpperCase()),
  /** null = global code (usable in any warehouse’s definitions) */
  warehouse_id: z.string().uuid().nullable().optional()
});

export const penaltyCodePatchSchema = z.object({
  is_active: z.boolean()
});

export const penaltyDefinitionSchema = z.object({
  penalty_code_id: z.string().uuid(),
  /** null = global definition (all warehouses); otherwise scoped to that site */
  warehouse_id: z.string().uuid().nullable().optional(),
  title: z.string().min(2),
  description: z.string().optional().nullable(),
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
  warehouse_id: z.string().uuid()
});

export const settlementPreviewQuerySchema = z.object({
  incident_date_from: z.string().optional(),
  incident_date_to: z.string().optional(),
  /** When true, ignore incident date bounds (export / preview for all time). */
  all_time: z
    .string()
    .optional()
    .transform((s) => s === "1" || s === "true"),
  /** Default applied in route: created (pending settlement). */
  status: z.enum(["created", "settled", "all"]).optional(),
  warehouse_id: z.string().uuid().optional(),
  staff_id: z.string().uuid().optional(),
  staff_type_id: z.string().uuid().optional(),
  group_by: z.enum(["staff", "staff_type", "warehouse"]).optional()
});

/** @deprecated use penaltyRecordCreateSchema */
export const penaltyRecordSchema = penaltyRecordCreateSchema;

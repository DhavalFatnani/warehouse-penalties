import { z } from "zod";

export type ResolveRowWarehouseArgs = {
  row: Record<string, string>;
  /** Fallback when row has no warehouse column (sidebar / form default). */
  defaultWarehouseId: string | null;
  /** Uppercased warehouse `code` → id for sites the user may use. */
  codeToId: Map<string, string>;
  accessibleIds: Set<string>;
};

export type ResolveRowWarehouseResult =
  | { ok: true; warehouse_id: string }
  | { ok: false; message: string };

/**
 * Resolve warehouse for one CSV row from optional `warehouse_id` (UUID) or
 * `warehouse_code` (matches `warehouses.code`), else `defaultWarehouseId`.
 */
export function resolveWarehouseForImportRow(
  args: ResolveRowWarehouseArgs
): ResolveRowWarehouseResult {
  const idRaw = (args.row.warehouse_id ?? "").trim();
  const codeRaw = (args.row.warehouse_code ?? "").trim();

  if (idRaw && codeRaw) {
    return {
      ok: false,
      message: "Use only one of warehouse_id or warehouse_code per row"
    };
  }

  if (idRaw) {
    const uuidOk = z.string().uuid().safeParse(idRaw);
    if (!uuidOk.success) {
      return { ok: false, message: "warehouse_id must be a valid UUID" };
    }
    if (!args.accessibleIds.has(idRaw)) {
      return {
        ok: false,
        message: "warehouse_id is unknown or you have no access to that site"
      };
    }
    return { ok: true, warehouse_id: idRaw };
  }

  if (codeRaw) {
    const id = args.codeToId.get(codeRaw.toUpperCase());
    if (!id) {
      return {
        ok: false,
        message: `Unknown warehouse_code "${codeRaw}" or no access`
      };
    }
    return { ok: true, warehouse_id: id };
  }

  if (!args.defaultWarehouseId) {
    return {
      ok: false,
      message:
        "warehouse_id or warehouse_code is required when no default site is selected"
    };
  }

  return { ok: true, warehouse_id: args.defaultWarehouseId };
}

/** Normalizes Supabase `penalty_codes` rows that embed `warehouses` via select. */

export const PENALTY_CODE_SELECT =
  "id, code, warehouse_id, created_at, is_active, warehouses ( id, code, name )";

export type PenaltyCodeWarehouse = {
  id: string;
  code: string;
  name: string;
};

export type PenaltyCodeApiRow = {
  id: string;
  code: string;
  warehouse_id: string | null;
  created_at?: string;
  is_active: boolean;
  warehouse: PenaltyCodeWarehouse | null;
};

function coerceWarehouseEmbed(
  raw: unknown
): { id: string; code: string; name: string } | null {
  if (raw == null) return null;
  if (Array.isArray(raw)) {
    const first = raw[0] as { id?: string; code?: string; name?: string } | undefined;
    if (!first || typeof first !== "object") return null;
    return {
      id: String(first.id ?? ""),
      code: String(first.code ?? ""),
      name: String(first.name ?? "")
    };
  }
  if (typeof raw === "object") {
    const w = raw as { id?: string; code?: string; name?: string };
    return {
      id: String(w.id ?? ""),
      code: String(w.code ?? ""),
      name: String(w.name ?? "")
    };
  }
  return null;
}

export function normalizePenaltyCodeRow(
  row: Record<string, unknown>
): PenaltyCodeApiRow {
  const warehouse = coerceWarehouseEmbed(row.warehouses);
  return {
    id: String(row.id),
    code: String(row.code ?? ""),
    warehouse_id:
      row.warehouse_id === null || row.warehouse_id === undefined
        ? null
        : String(row.warehouse_id),
    created_at:
      row.created_at != null ? String(row.created_at) : undefined,
    is_active: row.is_active !== false,
    warehouse
  };
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function looksLikeUuid(s: string): boolean {
  return UUID_RE.test(s.trim());
}

export function warehouseScopeDisplayLabel(
  warehouseId: string | null,
  embedded: PenaltyCodeWarehouse | null,
  lookup: { id: string; code: string; name: string }[]
): string {
  if (warehouseId == null) return "All sites";
  if (embedded && (embedded.code || embedded.name)) {
    const parts = [embedded.code, embedded.name].filter(
      (p) => p.trim().length > 0
    );
    return parts.length > 0 ? parts.join(" — ") : "Site";
  }
  const w = lookup.find((x) => x.id === warehouseId);
  if (w && (w.code || w.name)) {
    const parts = [w.code, w.name].filter((p) => p.trim().length > 0);
    return parts.length > 0 ? parts.join(" — ") : "Site";
  }
  if (looksLikeUuid(warehouseId)) {
    return "Site (details unavailable)";
  }
  return "Inactive or removed site";
}

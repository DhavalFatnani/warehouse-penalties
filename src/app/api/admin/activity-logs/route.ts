import { NextRequest } from "next/server";
import { requireRole } from "@/lib/auth";
import { adminClient } from "@/lib/supabase/admin";
import { jsonOk, toErrorResponse } from "@/lib/http";
import { NextResponse } from "next/server";

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;
const MAX_CSV_ROWS = 5000;

type AuditLogRow = {
  id: string;
  entity_type: string;
  entity_id: string;
  action: string;
  changed_by_user_id: string | null;
  changed_at: string;
  old_values: unknown;
  new_values: unknown;
};

function parsePositiveInt(value: string | null, fallback: number): number {
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) return fallback;
  return n;
}

function parseDateBoundary(value: string | null, endOfDay: boolean): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return `${trimmed}${endOfDay ? "T23:59:59.999Z" : "T00:00:00.000Z"}`;
  }
  const d = new Date(trimmed);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

function applyFilters(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  query: any,
  params: {
    q: string;
    changedByUserId: string;
    action: string;
    entityType: string;
    fromDate: string | null;
    toDate: string | null;
  }
) {
  let q = query;
  if (params.changedByUserId) {
    q = q.eq("changed_by_user_id", params.changedByUserId);
  }
  if (params.action) {
    q = q.eq("action", params.action);
  }
  if (params.entityType) {
    q = q.eq("entity_type", params.entityType);
  }
  if (params.fromDate) {
    q = q.gte("changed_at", params.fromDate);
  }
  if (params.toDate) {
    q = q.lte("changed_at", params.toDate);
  }
  if (params.q) {
    // Strip everything except alphanumeric, space, dash, and underscore to prevent
    // PostgREST filter injection. Dashes are kept so UUID searches still work.
    const search = params.q.replace(/[^a-zA-Z0-9 \-_]/g, "").trim();
    if (search) {
      q = q.or(`action.ilike.%${search}%,entity_type.ilike.%${search}%`);
      if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(search)) {
        q = q.eq("entity_id", search);
      }
    }
  }
  return q;
}

function csvCell(value: unknown): string {
  const raw =
    value == null
      ? ""
      : typeof value === "string"
        ? value
        : JSON.stringify(value);
  const escaped = raw.replace(/"/g, '""');
  return `"${escaped}"`;
}

export async function GET(req: NextRequest) {
  try {
    await requireRole(["admin"]);

    const format = (req.nextUrl.searchParams.get("format") ?? "").trim().toLowerCase();
    const page = parsePositiveInt(req.nextUrl.searchParams.get("page"), DEFAULT_PAGE);
    const page_size = Math.min(
      parsePositiveInt(req.nextUrl.searchParams.get("page_size"), DEFAULT_PAGE_SIZE),
      MAX_PAGE_SIZE
    );
    const offset = (page - 1) * page_size;

    const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
    const changedByUserId = (req.nextUrl.searchParams.get("changed_by_user_id") ?? "").trim();
    const action = (req.nextUrl.searchParams.get("action") ?? "").trim();
    const entityType = (req.nextUrl.searchParams.get("entity_type") ?? "").trim();
    const fromDate = parseDateBoundary(req.nextUrl.searchParams.get("from"), false);
    const toDate = parseDateBoundary(req.nextUrl.searchParams.get("to"), true);

    const countQuery = applyFilters(
      adminClient.from("audit_log").select("id", { count: "exact", head: true }),
      { q, changedByUserId, action, entityType, fromDate, toDate }
    );
    const { count, error: countError } = await countQuery;
    if (countError) throw new Error(countError.message);

    const dataQuery = applyFilters(
      adminClient
        .from("audit_log")
        .select(
          "id, entity_type, entity_id, action, changed_by_user_id, changed_at, old_values, new_values"
        )
        .order("changed_at", { ascending: false })
        .range(
          format === "csv" ? 0 : offset,
          format === "csv" ? MAX_CSV_ROWS - 1 : offset + page_size - 1
        ),
      { q, changedByUserId, action, entityType, fromDate, toDate }
    );
    const { data, error } = await dataQuery;
    if (error) throw new Error(error.message);
    const logRows = (data ?? []) as AuditLogRow[];

    const actorIds = [
      ...new Set(
        logRows
          .map((row) => row.changed_by_user_id as string | null)
          .filter((id): id is string => Boolean(id))
      )
    ];
    let actorById = new Map<string, { id: string; full_name: string; email: string }>();
    if (actorIds.length > 0) {
      const { data: users, error: usersError } = await adminClient
        .from("users")
        .select("id, full_name, email")
        .in("id", actorIds);
      if (usersError) throw new Error(usersError.message);
      actorById = new Map(
        (users ?? []).map((u) => [
          String(u.id),
          {
            id: String(u.id),
            full_name: String(u.full_name ?? ""),
            email: String(u.email ?? "")
          }
        ])
      );
    }

    const rows = logRows.map((row) => ({
      id: String(row.id),
      entity_type: String(row.entity_type ?? ""),
      entity_id: String(row.entity_id ?? ""),
      action: String(row.action ?? ""),
      changed_at: String(row.changed_at ?? ""),
      changed_by_user_id: row.changed_by_user_id ? String(row.changed_by_user_id) : null,
      old_values: row.old_values ?? null,
      new_values: row.new_values ?? null,
      actor: row.changed_by_user_id
        ? actorById.get(String(row.changed_by_user_id)) ?? null
        : null
    }));

    if (format === "csv") {
      const header = [
        "changed_at",
        "action",
        "entity_type",
        "entity_id",
        "actor_name",
        "actor_email",
        "changed_by_user_id",
        "old_values",
        "new_values"
      ];
      const csvLines = [header.join(",")];
      for (const row of rows) {
        csvLines.push(
          [
            csvCell(row.changed_at),
            csvCell(row.action),
            csvCell(row.entity_type),
            csvCell(row.entity_id),
            csvCell(row.actor?.full_name ?? ""),
            csvCell(row.actor?.email ?? ""),
            csvCell(row.changed_by_user_id ?? ""),
            csvCell(row.old_values),
            csvCell(row.new_values)
          ].join(",")
        );
      }
      return new NextResponse(csvLines.join("\n"), {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": 'attachment; filename="activity-logs.csv"'
        }
      });
    }

    return jsonOk({
      rows,
      page,
      page_size,
      total: count ?? 0
    });
  } catch (e) {
    return toErrorResponse(e);
  }
}

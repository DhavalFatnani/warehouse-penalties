import { adminClient } from "@/lib/supabase/admin";

export async function writeAudit(params: {
  entityType: string;
  entityId: string;
  action: string;
  changedByUserId?: string | null;
  oldValues?: unknown;
  newValues?: unknown;
}) {
  await adminClient.from("audit_log").insert({
    entity_type: params.entityType,
    entity_id: params.entityId,
    action: params.action,
    changed_by_user_id: params.changedByUserId ?? null,
    old_values: params.oldValues ?? null,
    new_values: params.newValues ?? null
  });
}

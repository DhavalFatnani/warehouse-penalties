import { NextRequest } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { adminClient } from "@/lib/supabase/admin";
import { jsonOk, toErrorResponse } from "@/lib/http";
import { writeAudit } from "@/lib/audit";
import { getAppUrlFromRequest } from "@/lib/app-url";

const schema = z.object({
  email: z.string().email(),
  full_name: z.string().min(1),
  role: z.enum(["manager", "admin"]).default("manager"),
  warehouse_ids: z.array(z.string().uuid()).default([])
});

export async function POST(req: NextRequest) {
  try {
    const { appUser } = await requireRole(["admin"]);
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) return toErrorResponse(parsed.error);

    const origin = getAppUrlFromRequest(req);
    const redirectTo = `${origin}/auth/callback?next=${encodeURIComponent("/dashboard")}`;

    const { data: created, error: inviteErr } =
      await adminClient.auth.admin.inviteUserByEmail(parsed.data.email, {
        data: {
          full_name: parsed.data.full_name
        },
        redirectTo
      });
    if (inviteErr) throw new Error(inviteErr.message);

    const authUserId = created.user?.id;
    if (!authUserId) throw new Error("Failed to create auth user");

    const { data: appRow, error: appErr } = await adminClient
      .from("users")
      .upsert(
        {
          auth_user_id: authUserId,
          email: parsed.data.email,
          full_name: parsed.data.full_name,
          role: parsed.data.role,
          is_active: true
        },
        { onConflict: "auth_user_id" }
      )
      .select("id, email, role")
      .single();
    if (appErr || !appRow) throw new Error(appErr?.message ?? "failed to upsert app user");

    const { error: accessErr } = await adminClient.rpc("replace_user_warehouse_access", {
      p_target_user_id: appRow.id,
      p_warehouse_ids: parsed.data.warehouse_ids
    });
    if (accessErr) throw new Error(accessErr.message);

    await writeAudit({
      entityType: "user",
      entityId: appRow.id,
      action: "admin_invite_email",
      changedByUserId: appUser.id,
      newValues: {
        email: parsed.data.email,
        role: parsed.data.role,
        warehouse_ids: parsed.data.warehouse_ids
      }
    });

    return jsonOk(
      {
        user_id: appRow.id,
        email: appRow.email,
        role: appRow.role,
        invite_sent: true
      },
      201
    );
  } catch (e) {
    return toErrorResponse(e);
  }
}

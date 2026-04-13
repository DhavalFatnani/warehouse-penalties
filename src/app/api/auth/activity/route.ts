import { NextRequest } from "next/server";
import { z } from "zod";
import { getCurrentAppUser } from "@/lib/auth";
import { jsonOk, toErrorResponse } from "@/lib/http";
import { writeAudit } from "@/lib/audit";

const schema = z.object({
  action: z.enum(["login", "logout"])
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) return toErrorResponse(parsed.error);

    const { appUser } = await getCurrentAppUser();
    const userAgent = req.headers.get("user-agent") ?? "";
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      req.headers.get("x-real-ip") ??
      null;

    await writeAudit({
      entityType: "auth_session",
      entityId: appUser.id,
      action: `auth_${parsed.data.action}`,
      changedByUserId: appUser.id,
      newValues: {
        role: appUser.role,
        user_agent: userAgent || null,
        ip
      }
    });

    return jsonOk({ ok: true });
  } catch (e) {
    return toErrorResponse(e);
  }
}

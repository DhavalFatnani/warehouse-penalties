import { NextRequest } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { getAppUrlFromRequest } from "@/lib/app-url";
import { HttpError, jsonOk, toErrorResponse } from "@/lib/http";
import { checkRateLimit } from "@/lib/rate-limit";

const bodySchema = z.object({
  email: z.string().email()
});

export async function POST(req: NextRequest) {
  try {
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      req.headers.get("x-real-ip") ??
      "unknown";
    const { allowed, retryAfterMs } = checkRateLimit({
      key: `forgot-password:${ip}`,
      limit: 5,
      windowMs: 15 * 60 * 1000
    });
    if (!allowed) {
      throw new HttpError(
        "RATE_LIMITED",
        "Too many requests. Please try again later.",
        429,
        { retryAfterSeconds: Math.ceil(retryAfterMs / 1000) }
      );
    }

    const body = await req.json();
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) return toErrorResponse(parsed.error);

    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_PUBLISHABLE_KEY;
    if (!url || !key) {
      throw new HttpError(
        "MISSING_SUPABASE_ENV",
        "Supabase env is not configured on the server",
        500
      );
    }

    const supabase = createSupabaseClient(url, key);
    const appUrl = getAppUrlFromRequest(req);
    const redirectTo = `${appUrl}/auth/callback?next=${encodeURIComponent(
      "/auth/update-password"
    )}`;

    const { error } = await supabase.auth.resetPasswordForEmail(
      parsed.data.email.trim(),
      { redirectTo }
    );
    if (error) {
      throw new HttpError(
        "RESET_EMAIL_FAILED",
        error.message || "Could not send reset email",
        400
      );
    }

    return jsonOk({ sent: true });
  } catch (e) {
    return toErrorResponse(e);
  }
}


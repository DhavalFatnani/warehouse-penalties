import { NextRequest } from "next/server";
import { requireRole } from "@/lib/auth";
import { adminClient } from "@/lib/supabase/admin";
import { jsonOk, toErrorResponse, HttpError } from "@/lib/http";
import { randomUUID } from "crypto";

const BUCKET = "penalty-attachments";
const MAX_BYTES = 5 * 1024 * 1024;

const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/pdf"
]);

const ALLOWED_EXTENSIONS = new Set(["jpg", "jpeg", "png", "webp", "gif", "pdf"]);

export async function POST(req: NextRequest) {
  try {
    await requireRole(["manager", "admin"]);
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      throw new HttpError("VALIDATION_ERROR", "file is required", 400);
    }
    if (file.size > MAX_BYTES) {
      throw new HttpError("PAYLOAD_TOO_LARGE", "Max file size is 5MB", 413);
    }

    const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
    if (!ALLOWED_EXTENSIONS.has(ext)) {
      throw new HttpError(
        "VALIDATION_ERROR",
        "Unsupported file type. Allowed: JPEG, PNG, WebP, GIF, PDF",
        415
      );
    }
    if (!ALLOWED_MIME_TYPES.has(file.type)) {
      throw new HttpError(
        "VALIDATION_ERROR",
        "Unsupported file type. Allowed: JPEG, PNG, WebP, GIF, PDF",
        415
      );
    }

    const safePath = `proofs/${randomUUID()}.${ext}`;
    const buf = Buffer.from(await file.arrayBuffer());

    const { error } = await adminClient.storage
      .from(BUCKET)
      .upload(safePath, buf, {
        contentType: file.type,
        upsert: false
      });

    if (error) {
      throw new HttpError("UPLOAD_FAILED", error.message, 500);
    }

    const { data: pub } = adminClient.storage.from(BUCKET).getPublicUrl(safePath);

    return jsonOk({ path: safePath, publicUrl: pub.publicUrl });
  } catch (e) {
    return toErrorResponse(e);
  }
}

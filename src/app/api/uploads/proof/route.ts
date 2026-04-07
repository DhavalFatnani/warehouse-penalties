import { NextRequest } from "next/server";
import { requireRole } from "@/lib/auth";
import { adminClient } from "@/lib/supabase/admin";
import { jsonOk, toErrorResponse, HttpError } from "@/lib/http";
import { randomUUID } from "crypto";

const BUCKET = "penalty-attachments";
const MAX_BYTES = 5 * 1024 * 1024;

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

    const ext = file.name.split(".").pop()?.toLowerCase() ?? "bin";
    const path = `proofs/${randomUUID()}.${ext}`;
    const buf = Buffer.from(await file.arrayBuffer());

    const { error } = await adminClient.storage
      .from(BUCKET)
      .upload(path, buf, {
        contentType: file.type || "application/octet-stream",
        upsert: false
      });

    if (error) {
      throw new HttpError("UPLOAD_FAILED", error.message, 500);
    }

    const { data: pub } = adminClient.storage.from(BUCKET).getPublicUrl(path);

    return jsonOk({ path, publicUrl: pub.publicUrl });
  } catch (e) {
    return toErrorResponse(e);
  }
}

import { getCurrentAppUser } from "@/lib/auth";
import { jsonOk, toErrorResponse } from "@/lib/http";

export async function GET() {
  try {
    const { appUser } = await getCurrentAppUser();
    return jsonOk({
      id: appUser.id,
      email: appUser.email,
      full_name: appUser.full_name,
      role: appUser.role,
      is_active: appUser.is_active
    });
  } catch (e) {
    return toErrorResponse(e);
  }
}

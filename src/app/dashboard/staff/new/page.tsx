import { redirect } from "next/navigation";

export default function StaffNewRedirectPage() {
  redirect("/dashboard/staff?tab=add");
}

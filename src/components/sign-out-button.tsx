"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";
import { Button } from "@/components/ui/button";

export function SignOutButton() {
  const router = useRouter();

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="h-auto px-2 py-1.5 text-xs font-normal text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
      onClick={async () => {
        await fetch("/api/auth/activity", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "logout" })
        }).catch(() => {
          // Best-effort logging; sign-out should always continue.
        });
        const supabase = createClient();
        await supabase.auth.signOut();
        router.push("/login");
        router.refresh();
      }}
    >
      Sign out
    </Button>
  );
}

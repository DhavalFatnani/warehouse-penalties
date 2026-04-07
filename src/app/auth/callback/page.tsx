"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";

function AuthCallbackInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [message, setMessage] = useState("Completing sign-in…");

  useEffect(() => {
    void (async () => {
      const supabase = createClient();
      const next = searchParams.get("next") ?? "/dashboard";

      const code = searchParams.get("code");
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) {
          setMessage("Sign-in failed.");
          router.replace(
            `/login?error=${encodeURIComponent(error.message)}`
          );
          return;
        }
        router.replace(next.startsWith("/") ? next : "/dashboard");
        return;
      }

      if (typeof window !== "undefined") {
        const hash = window.location.hash.replace(/^#/, "");
        if (hash.includes("access_token")) {
          const params = new URLSearchParams(hash);
          const access_token = params.get("access_token");
          const refresh_token = params.get("refresh_token");
          if (access_token && refresh_token) {
            const { error } = await supabase.auth.setSession({
              access_token,
              refresh_token
            });
            if (error) {
              setMessage("Sign-in failed.");
              router.replace(
                `/login?error=${encodeURIComponent(error.message)}`
              );
              return;
            }
            window.history.replaceState(
              null,
              "",
              `${window.location.pathname}${window.location.search}`
            );
            router.replace(next.startsWith("/") ? next : "/dashboard");
            return;
          }
        }
      }

      const {
        data: { session }
      } = await supabase.auth.getSession();
      if (session) {
        router.replace(next.startsWith("/") ? next : "/dashboard");
        return;
      }

      setMessage("Could not complete sign-in.");
      router.replace("/login?error=auth");
    })();
  }, [router, searchParams]);

  return (
    <div className="flex min-h-[100dvh] items-center justify-center p-6 text-sm text-muted-foreground">
      {message}
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[100dvh] items-center justify-center text-sm text-muted-foreground">
          Loading…
        </div>
      }
    >
      <AuthCallbackInner />
    </Suspense>
  );
}

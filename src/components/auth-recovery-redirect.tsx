"use client";

import { useEffect } from "react";

/**
 * Fallback for recovery links that land on "/" with hash tokens.
 * Some Supabase setups fall back to SITE_URL instead of /auth/callback.
 */
export function AuthRecoveryRedirect() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.location.pathname !== "/") return;

    const hash = window.location.hash.replace(/^#/, "");
    if (!hash) return;

    const params = new URLSearchParams(hash);
    const type = params.get("type");
    const accessToken = params.get("access_token");
    const refreshToken = params.get("refresh_token");

    if (type !== "recovery") return;
    if (!accessToken || !refreshToken) return;

    const next = encodeURIComponent("/auth/update-password");
    window.location.replace(`/auth/callback?next=${next}${window.location.hash}`);
  }, []);

  return null;
}


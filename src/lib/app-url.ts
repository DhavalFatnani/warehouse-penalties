import type { NextRequest } from "next/server";

function stripTrailingSlash(url: string): string {
  return url.replace(/\/$/, "");
}

function isLocalhostOrigin(url: string): boolean {
  try {
    const withProto = url.includes("://") ? url : `https://${url}`;
    const u = new URL(withProto);
    const h = u.hostname.toLowerCase();
    return h === "localhost" || h === "127.0.0.1" || h === "::1";
  } catch {
    return /localhost|127\.0\.0\.1/i.test(url);
  }
}

function httpsFromHost(host: string): string {
  const h = host.replace(/^https?:\/\//, "").replace(/\/$/, "");
  return `https://${h}`;
}

/**
 * Canonical site origin for auth redirects (invite, recovery).
 *
 * Set `NEXT_PUBLIC_APP_URL` in production (e.g. https://warehouse-payroll.vercel.app).
 * On Vercel, if that variable still points at localhost (common copy-paste mistake),
 * we fall back to this deployment's public URL (`VERCEL_URL`) so invite links work.
 */
export function getAppUrlFromRequest(req: NextRequest): string {
  const fromEnv = process.env.NEXT_PUBLIC_APP_URL?.trim() ?? "";
  const fromEnvNorm = fromEnv ? stripTrailingSlash(fromEnv) : "";
  const onVercel = process.env.VERCEL === "1";
  const vercelHost =
    process.env.VERCEL_URL?.replace(/^https?:\/\//, "").replace(/\/$/, "") ??
    "";

  if (onVercel && fromEnvNorm && isLocalhostOrigin(fromEnvNorm)) {
    if (vercelHost) return httpsFromHost(vercelHost);
  }

  if (fromEnvNorm) return fromEnvNorm;
  if (vercelHost) return httpsFromHost(vercelHost);
  return stripTrailingSlash(req.nextUrl.origin);
}

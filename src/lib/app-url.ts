import type { NextRequest } from "next/server";

/**
 * Canonical site origin for auth redirects (invite, recovery).
 * Set NEXT_PUBLIC_APP_URL in production (e.g. https://app.example.com).
 */
export function getAppUrlFromRequest(req: NextRequest): string {
  const env = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");
  if (env) return env;
  const vercel = process.env.VERCEL_URL;
  if (vercel) {
    const host = vercel.replace(/^https?:\/\//, "");
    return `https://${host}`;
  }
  return req.nextUrl.origin;
}

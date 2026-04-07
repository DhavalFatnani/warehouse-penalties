import { describe, expect, it, afterEach, beforeEach } from "vitest";
import type { NextRequest } from "next/server";
import { getAppUrlFromRequest } from "@/lib/app-url";

const ENV_KEYS = ["NEXT_PUBLIC_APP_URL", "VERCEL", "VERCEL_URL"] as const;

function mockReq(origin: string): NextRequest {
  return { nextUrl: { origin } } as NextRequest;
}

describe("getAppUrlFromRequest", () => {
  const saved: Partial<Record<(typeof ENV_KEYS)[number], string | undefined>> =
    {};

  beforeEach(() => {
    for (const k of ENV_KEYS) {
      saved[k] = process.env[k];
    }
  });

  afterEach(() => {
    for (const k of ENV_KEYS) {
      const v = saved[k];
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  });

  it("uses NEXT_PUBLIC_APP_URL when set and not localhost", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://warehouse-payroll.vercel.app";
    delete process.env.VERCEL;
    delete process.env.VERCEL_URL;
    expect(getAppUrlFromRequest(mockReq("http://localhost:3000"))).toBe(
      "https://warehouse-payroll.vercel.app"
    );
  });

  it("on Vercel, ignores localhost NEXT_PUBLIC_APP_URL and uses VERCEL_URL", () => {
    process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";
    process.env.VERCEL = "1";
    process.env.VERCEL_URL = "warehouse-payroll.vercel.app";
    expect(getAppUrlFromRequest(mockReq("http://localhost:3000"))).toBe(
      "https://warehouse-payroll.vercel.app"
    );
  });

  it("falls back to request origin when env empty", () => {
    delete process.env.NEXT_PUBLIC_APP_URL;
    delete process.env.VERCEL;
    delete process.env.VERCEL_URL;
    expect(getAppUrlFromRequest(mockReq("https://example.com"))).toBe(
      "https://example.com"
    );
  });
});

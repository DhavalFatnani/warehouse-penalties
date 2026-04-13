import { NextResponse } from "next/server";
import { ZodError } from "zod";

export type ApiErrorBody = {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
};

export class HttpError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = "HttpError";
  }
}

export function jsonError(
  code: string,
  message: string,
  status: number,
  details?: unknown
): NextResponse<ApiErrorBody> {
  return NextResponse.json(
    { error: { code, message, ...(details !== undefined ? { details } : {}) } },
    { status }
  );
}

export function jsonOk<T>(data: T, status = 200): NextResponse<{ data: T }> {
  return NextResponse.json({ data }, { status });
}

export function toErrorResponse(err: unknown): NextResponse<ApiErrorBody> {
  if (err instanceof ZodError) {
    return jsonError("VALIDATION_ERROR", "Invalid request body", 400, err.flatten());
  }
  if (err instanceof HttpError) {
    return jsonError(err.code, err.message, err.status, err.details);
  }
  if (err instanceof Error) {
    if (err.message === "Unauthorized") {
      return jsonError("UNAUTHORIZED", "Authentication required", 401);
    }
    if (err.message === "Forbidden") {
      return jsonError("FORBIDDEN", "Insufficient permissions", 403);
    }
    if (err.message === "FORBIDDEN_WAREHOUSE") {
      return jsonError(
        "FORBIDDEN_WAREHOUSE",
        "No access to this warehouse",
        403
      );
    }
    return jsonError("INTERNAL_ERROR", "An unexpected error occurred", 500);
  }
  return jsonError("INTERNAL_ERROR", "An unexpected error occurred", 500);
}

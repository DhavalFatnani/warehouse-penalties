/**
 * Simple in-memory sliding-window rate limiter.
 * Works per-instance; sufficient for single-server or low-traffic deployments.
 * For multi-instance Vercel deployments, swap the store for an Upstash Redis client.
 */

type Window = { count: number; resetAt: number };

const store = new Map<string, Window>();

export function checkRateLimit(params: {
  key: string;
  limit: number;
  windowMs: number;
}): { allowed: boolean; retryAfterMs: number } {
  const { key, limit, windowMs } = params;
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || now >= entry.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfterMs: 0 };
  }

  if (entry.count >= limit) {
    return { allowed: false, retryAfterMs: entry.resetAt - now };
  }

  entry.count += 1;
  return { allowed: true, retryAfterMs: 0 };
}

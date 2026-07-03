import { config } from "@/lib/config";

export type RateLimitBucket = "login" | "register" | "search" | "sync" | "admin";

const LIMITS: Record<RateLimitBucket, { max: number; windowMs: number }> = {
  login: { max: 10, windowMs: 60_000 },
  register: { max: 5, windowMs: 60_000 },
  search: { max: 60, windowMs: 60_000 },
  sync: { max: 5, windowMs: 60_000 },
  admin: { max: 120, windowMs: 60_000 }
};

type WindowState = { count: number; resetAt: number };

declare global {
  var __inSeriesRateLimitState: Map<string, WindowState> | undefined;
}

const state = globalThis.__inSeriesRateLimitState ?? new Map<string, WindowState>();
globalThis.__inSeriesRateLimitState = state;

export type RateLimitResult = { allowed: boolean; remaining: number; resetAt: number };

/**
 * Fixed-window in-memory limiter. Disabled by default (`config.rateLimit.enabled`
 * is false unless RATE_LIMIT_ENABLED is set) so it never risks throttling
 * legitimate traffic — including the smoke test — until explicitly turned on.
 * Prepared for login/register/search/sync/admin; not wired to a shared store
 * (Redis) yet, so limits are per-process/per-instance.
 */
export function checkRateLimit(bucket: RateLimitBucket, identifier: string): RateLimitResult {
  const limit = LIMITS[bucket];
  const now = Date.now();

  if (!config.rateLimit.enabled) {
    return { allowed: true, remaining: limit.max, resetAt: now + limit.windowMs };
  }

  const key = `${bucket}:${identifier}`;
  const existing = state.get(key);

  if (!existing || existing.resetAt <= now) {
    state.set(key, { count: 1, resetAt: now + limit.windowMs });
    return { allowed: true, remaining: limit.max - 1, resetAt: now + limit.windowMs };
  }

  if (existing.count >= limit.max) {
    return { allowed: false, remaining: 0, resetAt: existing.resetAt };
  }

  existing.count += 1;
  return { allowed: true, remaining: limit.max - existing.count, resetAt: existing.resetAt };
}

export function getClientIdentifier(request: Request): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}

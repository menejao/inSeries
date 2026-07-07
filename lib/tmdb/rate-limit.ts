import { config } from "@/lib/config";

/**
 * Fase 7/8 (INSERIES-TMDB-CATALOG-SCALE-01) — every outbound TMDb call (list pages,
 * series/season details, discover) goes through this wrapper: a concurrency-limited
 * queue (TMDB_MAX_CONCURRENT_REQUESTS), a minimum spacing between request starts
 * (TMDB_REQUEST_DELAY_MS), and exponential backoff retry specifically for rate-limit
 * (429) and transient/timeout failures — never for auth (401), not-found (404) or
 * configuration errors, which retrying can't fix. A sync run should never fail
 * entirely because of one flaky request or one series hitting a rate limit.
 */

type TmdbCallStats = {
  requestCount: number;
  retryCount: number;
  rateLimitHitCount: number;
  totalRequestMs: number;
};

function createInitialStats(): TmdbCallStats {
  return { requestCount: 0, retryCount: 0, rateLimitHitCount: 0, totalRequestMs: 0 };
}

declare global {
  var __inSeriesTmdbStats: TmdbCallStats | undefined;
}

const state = globalThis.__inSeriesTmdbStats ?? createInitialStats();
globalThis.__inSeriesTmdbStats = state;

/** Snapshot of cumulative call stats since process start (or last reset) — callers diff two snapshots to get per-run numbers. */
export function getTmdbCallStats(): TmdbCallStats {
  return { ...state };
}

export function resetTmdbCallStats() {
  state.requestCount = 0;
  state.retryCount = 0;
  state.rateLimitHitCount = 0;
  state.totalRequestMs = 0;
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

let activeRequests = 0;
const waiters: Array<() => void> = [];

async function acquireSlot(): Promise<void> {
  if (activeRequests < config.catalogSync.maxConcurrentRequests) {
    activeRequests += 1;
    return;
  }
  await new Promise<void>((resolve) => waiters.push(resolve));
  activeRequests += 1;
}

function releaseSlot() {
  activeRequests -= 1;
  const next = waiters.shift();
  if (next) next();
}

let lastRequestStartedAt = 0;

async function waitForPacing() {
  const delay = config.catalogSync.requestDelayMs;
  if (delay <= 0) return;
  const elapsed = Date.now() - lastRequestStartedAt;
  if (elapsed < delay) {
    await sleep(delay - elapsed);
  }
  lastRequestStartedAt = Date.now();
}

const MAX_RETRIES = 3;
const BASE_BACKOFF_MS = 500;

export type TmdbRetryClassifier = {
  /** True when the error represents TMDb's own rate limit (HTTP 429) — always retried and always counted separately. */
  isRateLimit?: (error: unknown) => boolean;
  /** True for other transient failures (timeouts, 5xx) worth retrying. Rate limit errors are always retried regardless of this. */
  isRetryable?: (error: unknown) => boolean;
};

/**
 * Runs `fn` (one TMDb HTTP call) behind the concurrency/pacing queue, retrying with
 * exponential backoff on rate-limit/transient errors up to MAX_RETRIES times.
 */
export async function withTmdbRateLimit<T>(fn: () => Promise<T>, classifier: TmdbRetryClassifier = {}): Promise<T> {
  await acquireSlot();
  try {
    await waitForPacing();

    let attempt = 0;
    for (;;) {
      const startedAt = Date.now();
      try {
        const result = await fn();
        state.requestCount += 1;
        state.totalRequestMs += Date.now() - startedAt;
        return result;
      } catch (error) {
        state.requestCount += 1;
        state.totalRequestMs += Date.now() - startedAt;

        const isRateLimit = classifier.isRateLimit?.(error) ?? false;
        if (isRateLimit) state.rateLimitHitCount += 1;

        const isRetryable = isRateLimit || (classifier.isRetryable?.(error) ?? false);
        if (!isRetryable || attempt >= MAX_RETRIES) throw error;

        attempt += 1;
        state.retryCount += 1;
        await sleep(BASE_BACKOFF_MS * 2 ** (attempt - 1));
      }
    }
  } finally {
    releaseSlot();
  }
}

/**
 * INSERIES-INSTAGRAM-PUBLISHER-05 — exponential backoff, restricted to temporary failures.
 *
 * The classification lives entirely in `instagram/errors.ts`; this module only reads
 * `PublishError.retryable`. That is the whole point: "nunca retry automatico para auth/permissao/
 * midia invalida" is enforced by one predicate in one file, not by scattered status-code checks.
 *
 * Backoff is 2^n seconds (1s, 2s, 4s, …) with a configurable cap. `sleep` is injectable so tests
 * verify the delays without actually waiting.
 */
import { logger } from "../../logger";
import { isRetryableError, isPublishError } from "../instagram/errors";
import { metaConfig } from "../../config";

export interface RetryPolicyOptions {
  /** Total attempts, including the first. Defaults to META_RETRY_LIMIT (3). */
  maxAttempts?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  sleep?: (ms: number) => Promise<void>;
  /** Called before each retry — used to write the RETRY_SCHEDULED history row. */
  onRetry?: (info: { attempt: number; delayMs: number; error: unknown }) => void | Promise<void>;
  /** Called after every attempt (success or failure) — used to persist `attempts`. */
  onAttempt?: (info: { attempt: number; error?: unknown }) => void | Promise<void>;
}

/** 2^(attempt-1) * base, capped. attempt is 1-based. */
export function computeBackoffMs(attempt: number, baseDelayMs = 1_000, maxDelayMs = 60_000): number {
  const raw = baseDelayMs * 2 ** Math.max(0, attempt - 1);
  return Math.min(raw, maxDelayMs);
}

export interface RetryOutcome<T> {
  result: T;
  /** How many attempts were actually spent (1 when it worked first time). */
  attempts: number;
}

/**
 * Runs `task` with exponential backoff. A non-retryable error aborts immediately with the attempt
 * count spent so far, so the caller can persist an accurate `attempts` value alongside `FAILED`.
 */
export async function runWithRetry<T>(task: (attempt: number) => Promise<T>, options: RetryPolicyOptions = {}): Promise<RetryOutcome<T>> {
  const maxAttempts = Math.max(1, options.maxAttempts ?? metaConfig.retryLimit);
  const baseDelayMs = options.baseDelayMs ?? 1_000;
  const maxDelayMs = options.maxDelayMs ?? 60_000;
  const sleep = options.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));

  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const result = await task(attempt);
      await options.onAttempt?.({ attempt });
      return { result, attempts: attempt };
    } catch (error) {
      lastError = error;
      await options.onAttempt?.({ attempt, error });

      const retryable = isRetryableError(error);
      const kind = isPublishError(error) ? error.kind : "unknown";

      if (!retryable) {
        logger.warn("publisher:retry:not-retryable", { module: "publisher", metadata: { attempt, kind } });
        throw error;
      }

      if (attempt >= maxAttempts) {
        logger.warn("publisher:retry:exhausted", { module: "publisher", metadata: { attempt, maxAttempts, kind } });
        throw error;
      }

      const delayMs = computeBackoffMs(attempt, baseDelayMs, maxDelayMs);
      logger.info("publisher:retry:scheduled", { module: "publisher", metadata: { attempt, nextAttempt: attempt + 1, delayMs, kind } });
      await options.onRetry?.({ attempt, delayMs, error });
      await sleep(delayMs);
    }
  }

  throw lastError;
}

/**
 * INSERIES-INSTAGRAM-PUBLISHER-05 — the single place that decides "is this failure worth retrying?".
 *
 * The retry policy (../retries/retry-policy.ts) never inspects HTTP status codes or Meta error
 * codes itself: it only reads `error.retryable`. That keeps the "NUNCA retry automatico para
 * auth/permissao/midia invalida" rule enforced in exactly one file.
 */
import { maskText } from "../utils/mask";

export type PublishErrorKind =
  /** Bad/expired token, wrong app — a human must fix the config. Never retried. */
  | "auth"
  /** Token is valid but lacks the permission/scope for this action. Never retried. */
  | "permission"
  /** Meta refused the media itself (bad URL, unsupported aspect ratio, >10 carousel items). Never retried. */
  | "invalid-media"
  /** Our own validation refused to even send the request. Never retried. */
  | "validation"
  /** Public image hosting is not configured. Never retried — it is an infrastructure gap. */
  | "not-configured"
  /** 429 / code 4 / code 32 — retryable with backoff. */
  | "rate-limit"
  /** AbortController fired. Retryable. */
  | "timeout"
  /** 5xx, network failure, container still IN_PROGRESS. Retryable. */
  | "temporary";

const RETRYABLE_KINDS: readonly PublishErrorKind[] = ["rate-limit", "timeout", "temporary"];

export class PublishError extends Error {
  readonly kind: PublishErrorKind;
  readonly retryable: boolean;
  /** Meta's numeric `error.code`, when the response carried one. */
  readonly graphCode: number | null;
  readonly graphSubcode: number | null;
  readonly httpStatus: number | null;

  constructor(
    kind: PublishErrorKind,
    message: string,
    options: { graphCode?: number | null; graphSubcode?: number | null; httpStatus?: number | null; cause?: unknown } = {}
  ) {
    // Masked at construction: nothing downstream has to remember to do it.
    super(maskText(message));
    this.name = "PublishError";
    this.kind = kind;
    this.retryable = RETRYABLE_KINDS.includes(kind);
    this.graphCode = options.graphCode ?? null;
    this.graphSubcode = options.graphSubcode ?? null;
    this.httpStatus = options.httpStatus ?? null;
    if (options.cause !== undefined) (this as { cause?: unknown }).cause = options.cause;
  }

  /** Safe to show an admin in the panel: masked message, no stack, no token. */
  toAdminMessage(): string {
    return this.message;
  }
}

export function isPublishError(error: unknown): error is PublishError {
  return error instanceof PublishError;
}

/** Unknown throwables are treated as temporary — a bug should not permanently kill a publication. */
export function isRetryableError(error: unknown): boolean {
  return isPublishError(error) ? error.retryable : true;
}

/**
 * Meta Graph API error codes, mapped per the public error-code reference.
 *  - 190: invalid/expired access token
 *  -  10, 200..299: permission denied for this action
 *  - 100: invalid parameter (bad image_url, bad children, unsupported media)
 *  -   4, 17, 32, 613: application/user request-limit reached
 *  -   1,  2: temporary/unknown API error
 */
export function classifyGraphError(code: number | null, subcode: number | null, httpStatus: number): PublishErrorKind {
  if (code === 190 || subcode === 463 || subcode === 467) return "auth";
  if (code === 10 || (code !== null && code >= 200 && code <= 299)) return "permission";
  if (code === 4 || code === 17 || code === 32 || code === 613 || httpStatus === 429) return "rate-limit";
  if (code === 100 || code === 9004 || code === 2207008 || code === 2207009 || code === 2207020) return "invalid-media";
  if (code === 1 || code === 2) return "temporary";
  if (httpStatus >= 500) return "temporary";
  if (httpStatus === 401 || httpStatus === 403) return "auth";
  if (httpStatus >= 400) return "invalid-media";
  return "temporary";
}

/**
 * INSERIES-SOCIAL-PUBLIC-MEDIA-STORAGE-07 — the storage contract.
 *
 * ## Why this file exists (and what it replaces)
 *
 * Ticket 05 (`publisher/instagram/image-hosting.ts`) declared an `ImageHostingService` that could
 * only *compose* URLs — it had no upload, because no object storage existed in the repo. That
 * interface is insufficient for this ticket (it cannot express bytes, checksum, expiry or provider),
 * so `ImageHostingService` is EVOLVED here and this module is now its ONLY definition. The publisher
 * side keeps its own, narrower concern under the new name `PublicationMediaResolver`: "given a
 * publication, give me public HTTPS URLs" — it delegates the actual bytes-to-URL step to this
 * interface. There is exactly one `ImageHostingService` in the repository, and it lives here.
 *
 * Nothing in this module knows about Prisma, Instagram, or the Template Engine. It takes a Buffer
 * and gives back a `HostedMedia`.
 */

export type MediaFormat = "feed" | "carousel" | "story";

export const PNG_CONTENT_TYPE = "image/png";

/** The bytes plus everything needed to compute a deterministic, collision-free storage key. */
export interface MediaAsset {
  publicationId: string;
  format: MediaFormat;
  /** 0 for feed/story; 0-based slide position for a carousel. Part of the key, so order is stable. */
  slideIndex: number;
  /**
   * A version of the CONTENT that produced these pixels — `SocialContent.updatedAt` (the same
   * strategy `template-engine/renderer` already uses for its preview cache key). Editing the
   * content changes this, which changes the key, which produces a new asset instead of silently
   * serving stale art.
   */
  contentVersion: string;
  buffer: Buffer;
  /** Declared type. NEVER trusted — `validation.ts` reads the real bytes. Defaults to image/png. */
  contentType?: string;
}

/**
 * A file that is live on the public internet. Every field is safe to log EXCEPT that we still run
 * `publicUrl` through the sanitizer before logging: a public Vercel Blob URL carries no credential
 * today, but "today" is not a guarantee worth betting a token on.
 */
export interface HostedMedia {
  /** The storage pathname — the deterministic key. Stable across retries for identical content. */
  id: string;
  publicUrl: string;
  contentType: string;
  size: number;
  /** sha256 (hex) of the exact bytes uploaded. Also embedded in `id`. */
  checksum: string;
  createdAt: Date;
  /** `createdAt + SOCIAL_MEDIA_RETENTION_HOURS`. Advisory: enforced by `cleanup.ts`, not by the provider. */
  expiresAt: Date;
  provider: string;
  /** True when an identical object already existed and no bytes were re-sent. */
  reused: boolean;
}

export interface HostingHealth {
  configured: boolean;
  provider: string;
  prefix: string;
  retentionHours: number;
  /** Whether the prefix could actually be listed. `false` with `configured: true` means credentials/network. */
  reachable: boolean;
  /** Number of objects currently under the prefix, when listing succeeded. */
  objectCount: number | null;
  /** True only for the explicit administrative write test (upload + delete of a tiny asset). */
  writeTested: boolean;
  /** Already sanitized. Never contains a token. */
  error: string | null;
  checkedAt: Date;
}

export interface CleanupCandidate {
  pathname: string;
  publicUrl: string;
  uploadedAt: Date;
  size: number;
}

export interface ImageHostingService {
  readonly provider: string;
  isConfigured(): boolean;
  /** Validates, then uploads (or reuses an identical existing object). Throws `MediaHostingError`. */
  upload(asset: MediaAsset): Promise<HostedMedia>;
  /**
   * All-or-nothing. Used by the carousel path: order is preserved and ANY failure rejects, so the
   * caller never gets a partial set it could accidentally publish.
   */
  uploadAll(assets: MediaAsset[]): Promise<HostedMedia[]>;
  /** Idempotent: removing something that is already gone resolves `false`, it does not throw. */
  remove(target: string): Promise<boolean>;
  /** Objects under the configured prefix, for `cleanup.ts`. Never lists outside the prefix. */
  list(prefix?: string): Promise<CleanupCandidate[]>;
  /** Non-destructive by default; `{ write: true }` performs the explicit admin upload+delete test. */
  health(options?: { write?: boolean }): Promise<HostingHealth>;
}

export type MediaHostingErrorKind =
  /** No token / unsupported provider. A human must configure it. Never retried. */
  | "not-configured"
  /** The buffer is not an acceptable PNG (signature, size, dimensions, emptiness). Never retried. */
  | "validation"
  /** Network/provider failure while uploading or listing. Retryable. */
  | "upload-failed";

const RETRYABLE: readonly MediaHostingErrorKind[] = ["upload-failed"];

/**
 * Kept independent of `publisher/instagram/errors.ts` on purpose — this module must not depend on
 * the Instagram publisher. The publisher-side bridge maps these onto `PublishError` kinds:
 *   not-configured -> "not-configured" (non-retryable)
 *   validation     -> "validation"     (non-retryable)
 *   upload-failed  -> "temporary"      (retryable — a flaky upload deserves the same backoff a
 *                                       flaky Graph call gets; see retries/retry-policy.ts)
 */
export class MediaHostingError extends Error {
  readonly kind: MediaHostingErrorKind;
  readonly retryable: boolean;

  constructor(kind: MediaHostingErrorKind, message: string, options: { cause?: unknown } = {}) {
    super(message);
    this.name = "MediaHostingError";
    this.kind = kind;
    this.retryable = RETRYABLE.includes(kind);
    if (options.cause !== undefined) (this as { cause?: unknown }).cause = options.cause;
  }
}

export function isMediaHostingError(error: unknown): error is MediaHostingError {
  return error instanceof MediaHostingError;
}

/**
 * INSERIES-SOCIAL-PUBLIC-MEDIA-STORAGE-07 — the deterministic object key.
 *
 * This function IS the idempotency mechanism. The ticket forbids a new table, so "have I already
 * uploaded this?" must be answerable from the key alone:
 *
 *   social-media/<publicationId>/<format>/<slide>-<versionHash>-<checksum>.png
 *
 *  - `publicationId` scopes everything one publication owns (and lets cleanup attribute an object
 *    back to a row without any metadata lookup);
 *  - `format` + `slide` keep carousel order explicit and stable;
 *  - `versionHash` is a hash of the content version (`SocialContent.updatedAt`) — the SAME
 *    invalidation strategy the renderer's preview cache already uses (`previewCacheKey`);
 *  - `checksum` is the sha256 of the exact bytes, so DIFFERENT PIXELS CAN NEVER SHARE A KEY. That
 *    is what makes "content changed -> new asset" free: nobody has to detect the change, the key
 *    simply stops matching.
 *
 * Nothing random is ever appended (`addRandomSuffix: false` on the provider side); a retry of an
 * unchanged publication recomputes the identical key and reuses the object already online.
 */
import { createHash } from "node:crypto";
import { mediaStorageConfig, type MediaStorageConfig } from "../config";
import type { MediaFormat } from "./types";

/** Length chosen so a collision is impossible in practice while keeping the path readable. */
const VERSION_HASH_LENGTH = 12;
const CHECKSUM_LENGTH = 32;

/** Keeps a path segment to `[a-z0-9-]` so no id can ever escape the prefix or break a URL. */
export function sanitizeSegment(value: string): string {
  const cleaned = String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
  return cleaned || "sem-id";
}

export function hashVersion(contentVersion: string): string {
  return createHash("sha256").update(String(contentVersion)).digest("hex").slice(0, VERSION_HASH_LENGTH);
}

export interface MediaKeyInput {
  publicationId: string;
  format: MediaFormat;
  slideIndex: number;
  contentVersion: string;
  /** Full sha256 hex of the buffer; truncated inside the key for readability. */
  checksum: string;
}

export function buildMediaKey(input: MediaKeyInput, config: MediaStorageConfig = mediaStorageConfig): string {
  const slide = String(Math.max(0, Math.floor(input.slideIndex))).padStart(2, "0");
  const version = hashVersion(input.contentVersion);
  const checksum = sanitizeSegment(input.checksum).slice(0, CHECKSUM_LENGTH);
  return `${config.prefix}${sanitizeSegment(input.publicationId)}/${sanitizeSegment(input.format)}/${slide}-${version}-${checksum}.png`;
}

/** The reverse lookup cleanup needs: which publication does this object belong to? */
export function publicationIdFromKey(pathname: string, config: MediaStorageConfig = mediaStorageConfig): string | null {
  if (!pathname.startsWith(config.prefix)) return null;
  const [publicationId] = pathname.slice(config.prefix.length).split("/");
  return publicationId || null;
}

/** Hard guard used everywhere a destructive/listing operation happens. */
export function isInsidePrefix(pathname: string, config: MediaStorageConfig = mediaStorageConfig): boolean {
  return typeof pathname === "string" && pathname.startsWith(config.prefix) && !pathname.includes("..");
}

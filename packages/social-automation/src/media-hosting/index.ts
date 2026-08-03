/**
 * INSERIES-SOCIAL-PUBLIC-MEDIA-STORAGE-07 — public surface of the media-hosting module.
 *
 * Import from here, never from the sub-files: this is the boundary that guarantees there is exactly
 * ONE `ImageHostingService` in the repository (see `types.ts` for why the ticket-05 interface of the
 * same name was superseded rather than kept alongside).
 */
export {
  MediaHostingError,
  isMediaHostingError,
  PNG_CONTENT_TYPE,
  type CleanupCandidate,
  type HostedMedia,
  type HostingHealth,
  type ImageHostingService,
  type MediaAsset,
  type MediaFormat,
  type MediaHostingErrorKind
} from "./types";

export { getImageHostingService, resetImageHostingService } from "./factory";
export { VercelBlobImageHostingService, VERCEL_BLOB_PROVIDER, HEALTH_CHECK_PNG } from "./vercel-blob-provider";
export { NotConfiguredImageHostingService, MEDIA_STORAGE_NOT_CONFIGURED_MESSAGE } from "./not-configured-provider";

export { buildMediaKey, hashVersion, sanitizeSegment, publicationIdFromKey, isInsidePrefix, type MediaKeyInput } from "./key";
export {
  validateAsset,
  computeChecksum,
  hasPngSignature,
  readPngDimensions,
  EXPECTED_DIMENSIONS,
  PNG_SIGNATURE,
  type PngDimensions,
  type ValidatedAsset
} from "./validation";
export { cleanupExpiredMedia, isExpired, IN_FLIGHT_STATUSES, type CleanupOptions, type CleanupResult } from "./cleanup";

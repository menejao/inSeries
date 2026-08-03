/**
 * INSERIES-SOCIAL-PUBLIC-MEDIA-STORAGE-07 — the ONE place that decides configured vs not-configured.
 *
 * The rule is absolute and has no escape hatch: no `BLOB_READ_WRITE_TOKEN`, or a
 * `SOCIAL_MEDIA_STORAGE_PROVIDER` naming a provider this package does not implement, means
 * `NotConfiguredImageHostingService`. There is deliberately no "assume it'll work" branch — a
 * half-configured storage would surface as a half-published Instagram post.
 */
import { isMediaStorageConfigured, mediaStorageConfig, type MediaStorageConfig } from "../config";
import { logger } from "../logger";
import { NotConfiguredImageHostingService } from "./not-configured-provider";
import { VercelBlobImageHostingService } from "./vercel-blob-provider";
import type { ImageHostingService } from "./types";

let cached: { service: ImageHostingService; config: MediaStorageConfig } | null = null;

/**
 * Memoised per config object so a hot publish loop does not rebuild the client. Tests pass their
 * own config, which bypasses the cache (and `resetImageHostingService()` clears it explicitly).
 */
export function getImageHostingService(config: MediaStorageConfig = mediaStorageConfig): ImageHostingService {
  if (cached && cached.config === config) return cached.service;

  const service = buildImageHostingService(config);
  cached = { service, config };
  return service;
}

function buildImageHostingService(config: MediaStorageConfig): ImageHostingService {
  if (config.providerWarning) {
    logger.warn("media-hosting:provider-invalido", { module: "media-hosting", metadata: { warning: config.providerWarning } });
    return new NotConfiguredImageHostingService(config);
  }

  if (!isMediaStorageConfigured(config)) {
    logger.warn("media-hosting:nao-configurado", {
      module: "media-hosting",
      // Booleans only — the token itself is never logged, not even masked.
      metadata: { provider: config.provider, hasToken: Boolean(config.token), envVar: "BLOB_READ_WRITE_TOKEN" }
    });
    return new NotConfiguredImageHostingService(config);
  }

  logger.info("media-hosting:configurado", {
    module: "media-hosting",
    metadata: { provider: config.provider, prefix: config.prefix, retentionHours: config.retentionHours }
  });
  return new VercelBlobImageHostingService(config);
}

export function resetImageHostingService(): void {
  cached = null;
}

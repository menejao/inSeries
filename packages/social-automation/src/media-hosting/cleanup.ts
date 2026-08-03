/**
 * INSERIES-SOCIAL-PUBLIC-MEDIA-STORAGE-07 — retention sweep.
 *
 * This is the only destructive code in the module, so it is defensive by construction:
 *
 *  1. it NEVER lists or deletes outside `SOCIAL_MEDIA_STORAGE_PREFIX` (`isInsidePrefix` guards both
 *     the listing and every individual delete);
 *  2. an object is only a candidate once it is OLDER than `SOCIAL_MEDIA_RETENTION_HOURS`, which zod
 *     refuses to set below 24h — a shorter window would delete assets of publications still retrying;
 *  3. an object whose publication is still PENDING / SCHEDULED / UPLOADING / PUBLISHING is SKIPPED
 *     regardless of age. Age alone is not proof of abandonment: a queued retry can outlive the
 *     window, and deleting its art would break a publish that was going to succeed;
 *  4. it is idempotent — a second run finds nothing, and a delete of an already-gone object resolves
 *     `false` instead of throwing;
 *  5. it logs pathnames only. No token, no signed URL, no publication payload.
 *
 * Vercel Blob has no native TTL (there is no S3-style lifecycle rule), so expiry is computed here
 * from the `uploadedAt` that `list()` returns. That is exactly why this must be invoked explicitly
 * (`npm run social:media:cleanup`) and never as a side effect of a request.
 */
import { logger } from "../logger";
import { mediaStorageConfig, type MediaStorageConfig } from "../config";
import { getImageHostingService } from "./factory";
import { isInsidePrefix, publicationIdFromKey } from "./key";
import type { CleanupCandidate, ImageHostingService } from "./types";

/** Statuses whose assets are off-limits no matter how old the object is. */
export const IN_FLIGHT_STATUSES = ["PENDING", "SCHEDULED", "UPLOADING", "PUBLISHING"] as const;

export interface CleanupOptions {
  service?: ImageHostingService;
  config?: MediaStorageConfig;
  now?: Date;
  /** Report what WOULD be deleted without deleting anything. */
  dryRun?: boolean;
  /**
   * Resolves which publication ids are still in flight. Injected so this module never imports
   * Prisma directly (and so tests need no database). Defaults to the real repository lookup.
   */
  findInFlightPublicationIds?: (ids: string[]) => Promise<string[]>;
}

export interface CleanupResult {
  scanned: number;
  deleted: string[];
  /** Still inside the retention window. */
  retained: number;
  /** Old enough, but belonging to a publication still in flight. */
  skippedInFlight: string[];
  failed: Array<{ pathname: string; error: string }>;
  dryRun: boolean;
  retentionHours: number;
  prefix: string;
}

/** The default resolver. Imported lazily so importing this module never opens a DB connection. */
async function defaultInFlightLookup(ids: string[]): Promise<string[]> {
  if (ids.length === 0) return [];
  const { prisma } = await import("../db/client");
  const rows = await prisma.socialPublication.findMany({
    where: { id: { in: ids }, status: { in: IN_FLIGHT_STATUSES as unknown as never } },
    select: { id: true }
  });
  return rows.map((row) => row.id);
}

export function isExpired(candidate: CleanupCandidate, now: Date, retentionHours: number): boolean {
  return now.getTime() - candidate.uploadedAt.getTime() > retentionHours * 3_600_000;
}

export async function cleanupExpiredMedia(options: CleanupOptions = {}): Promise<CleanupResult> {
  const config = options.config ?? mediaStorageConfig;
  const service = options.service ?? getImageHostingService(config);
  const now = options.now ?? new Date();
  const dryRun = options.dryRun === true;
  const findInFlight = options.findInFlightPublicationIds ?? defaultInFlightLookup;

  const result: CleanupResult = {
    scanned: 0,
    deleted: [],
    retained: 0,
    skippedInFlight: [],
    failed: [],
    dryRun,
    retentionHours: config.retentionHours,
    prefix: config.prefix
  };

  if (!service.isConfigured()) {
    logger.warn("media-hosting:cleanup:sem-storage", { module: "media-hosting", metadata: { prefix: config.prefix } });
    return result;
  }

  const objects = await service.list(config.prefix);
  result.scanned = objects.length;

  // Age filter first: the DB is only consulted for objects that are actually deletion candidates.
  const expired = objects.filter((candidate) => isInsidePrefix(candidate.pathname, config) && isExpired(candidate, now, config.retentionHours));
  result.retained = objects.length - expired.length;

  const publicationIds = [...new Set(expired.map((candidate) => publicationIdFromKey(candidate.pathname, config)).filter((id): id is string => Boolean(id)))];
  const inFlight = new Set(await findInFlight(publicationIds));

  for (const candidate of expired) {
    const publicationId = publicationIdFromKey(candidate.pathname, config);
    if (publicationId && inFlight.has(publicationId)) {
      result.skippedInFlight.push(candidate.pathname);
      continue;
    }

    if (dryRun) {
      result.deleted.push(candidate.pathname);
      continue;
    }

    try {
      await service.remove(candidate.pathname);
      result.deleted.push(candidate.pathname);
    } catch (error) {
      // One bad object must never abort the sweep — record it and keep going.
      result.failed.push({ pathname: candidate.pathname, error: error instanceof Error ? error.message : String(error) });
    }
  }

  logger.info("media-hosting:cleanup:concluido", {
    module: "media-hosting",
    metadata: {
      prefix: config.prefix,
      retentionHours: config.retentionHours,
      scanned: result.scanned,
      deleted: result.deleted.length,
      retained: result.retained,
      skippedInFlight: result.skippedInFlight.length,
      failed: result.failed.length,
      dryRun
    }
  });

  return result;
}

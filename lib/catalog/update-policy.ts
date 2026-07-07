import type { SeriesLifecycleStatus } from "@prisma/client";

/**
 * Fase 6 (INSERIES-TMDB-CATALOG-COVERAGE-01) — how often an already-catalogued series is
 * worth refreshing depends on how alive it is: a RETURNING/IN_PRODUCTION series can have
 * a new season, air date or poster any day; an ENDED series changes rarely; a CANCELED
 * one almost never changes at all. Reusable by both `syncCoverage` (Fase 2-9) and
 * `syncUpdateDue` (the standalone `sync:update`), so the policy lives in exactly one place.
 */
const DAY_MS = 24 * 60 * 60 * 1000;

const UPDATE_INTERVAL_MS: Record<SeriesLifecycleStatus, number> = {
  RETURNING: DAY_MS,
  IN_PRODUCTION: DAY_MS,
  PILOT: DAY_MS,
  ENDED: 7 * DAY_MS,
  CANCELED: 30 * DAY_MS
};

export function getUpdateIntervalMs(status: SeriesLifecycleStatus): number {
  return UPDATE_INTERVAL_MS[status] ?? DAY_MS;
}

/** A series that's never been synced (`lastSyncedAt` null) is always due. */
export function isDueForUpdate(status: SeriesLifecycleStatus, lastSyncedAt: Date | null, now: Date = new Date()): boolean {
  if (!lastSyncedAt) return true;
  return now.getTime() - lastSyncedAt.getTime() >= getUpdateIntervalMs(status);
}

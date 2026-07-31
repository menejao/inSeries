/**
 * INSERIES-SERIES-STATUS-ENGINE-01 — the single definition of "available episode" every
 * progress/status calculation must use: `release_date <= now`. An episode with no `airedAt`
 * yet (not synced/announced) is never available either — same rule as "future episode".
 */
export function isEpisodeAvailable(airedAt: Date | null, now: Date = new Date()): boolean {
  return airedAt !== null && airedAt <= now;
}

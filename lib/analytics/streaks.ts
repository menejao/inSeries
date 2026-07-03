import type { StreakStats, WatchedEpisodeRecord } from "@/lib/analytics/types";

/** UTC day key, consistent with timeline.ts bucketing. */
function dayKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function shiftDayKey(key: string, deltaDays: number) {
  const date = new Date(`${key}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + deltaDays);
  return dayKey(date);
}

/**
 * Streaks (Fase 8) — purely informational, no gamification (no badges, no
 * levels, nothing persisted). A "day" is a UTC calendar day with at least
 * one episode marked watched; "current streak" is the run of consecutive
 * active days ending today, or ending yesterday if nothing is logged yet
 * today (so marking an episode later today doesn't retroactively look like
 * a broken streak while the day is still in progress).
 */
export function computeStreakStats(watchedEpisodes: WatchedEpisodeRecord[]): StreakStats {
  if (watchedEpisodes.length === 0) {
    return { currentStreakDays: 0, longestStreakDays: 0, activeDays: 0, firstWatchedAt: null, lastWatchedAt: null };
  }

  const activeDaySet = new Set(watchedEpisodes.map((episode) => dayKey(episode.watchedAt)));
  const sortedDays = [...activeDaySet].sort();

  let longestStreakDays = 1;
  let running = 1;
  for (let i = 1; i < sortedDays.length; i++) {
    if (shiftDayKey(sortedDays[i - 1], 1) === sortedDays[i]) {
      running += 1;
    } else {
      running = 1;
    }
    longestStreakDays = Math.max(longestStreakDays, running);
  }

  const todayKey = dayKey(new Date());
  const yesterdayKey = shiftDayKey(todayKey, -1);
  let cursor: string | null = activeDaySet.has(todayKey) ? todayKey : activeDaySet.has(yesterdayKey) ? yesterdayKey : null;

  let currentStreakDays = 0;
  while (cursor && activeDaySet.has(cursor)) {
    currentStreakDays += 1;
    cursor = shiftDayKey(cursor, -1);
  }

  const watchedTimestamps = watchedEpisodes.map((episode) => episode.watchedAt.getTime());

  return {
    currentStreakDays,
    longestStreakDays,
    activeDays: activeDaySet.size,
    firstWatchedAt: new Date(Math.min(...watchedTimestamps)),
    lastWatchedAt: new Date(Math.max(...watchedTimestamps))
  };
}

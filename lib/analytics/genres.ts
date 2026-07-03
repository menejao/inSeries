import type { GenreStat, GenreStats, WatchedEpisodeRecord } from "@/lib/analytics/types";

/**
 * Genre stats (Fase 6). A series can have multiple genres, so the unit
 * counted here is a "genre tag occurrence": every watched episode adds one
 * point to *each* genre tag on its series (a 2-genre series contributes to
 * both buckets for every episode watched of it) — this is a deliberate
 * choice, not a bug: it means an episode of a "Drama/Comedy" series counts
 * fully toward both genres rather than splitting 0.5/0.5. Percentages are
 * relative to the total number of tag occurrences (not episode count), so
 * they always sum to 100% across the full ranking.
 *
 * Takes a plain array (not the full dataset) so a future "genre evolution
 * over time" feature can call this with an already date-filtered slice of
 * `watchedEpisodes` without any changes here.
 */
export function computeGenreStats(watchedEpisodes: WatchedEpisodeRecord[]): GenreStats {
  const counts = new Map<string, number>();

  for (const episode of watchedEpisodes) {
    for (const genre of episode.seriesGenres) {
      counts.set(genre, (counts.get(genre) ?? 0) + 1);
    }
  }

  const totalTagOccurrences = [...counts.values()].reduce((sum, count) => sum + count, 0);

  const ranking: GenreStat[] = [...counts.entries()]
    .map(([genre, episodeCount]) => ({
      genre,
      episodeCount,
      percentage: totalTagOccurrences ? Math.round((episodeCount / totalTagOccurrences) * 1000) / 10 : 0
    }))
    .sort((a, b) => b.episodeCount - a.episodeCount || a.genre.localeCompare(b.genre));

  return {
    ranking,
    topGenre: ranking[0] ?? null
  };
}

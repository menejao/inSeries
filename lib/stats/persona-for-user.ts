import { fetchAnalyticsDataset } from "@/lib/analytics/dataset";
import { computeOverviewStats } from "@/lib/analytics/overview";
import { computeGenreStats } from "@/lib/analytics/genres";
import { computeStreakStats } from "@/lib/analytics/streaks";
import { computeFunRecords } from "@/lib/stats/records";
import { classifyViewerPersona } from "@/lib/stats/persona";
import { getUserLevel } from "@/lib/gamification";
import type { ViewerPersona } from "@/lib/stats/types";

/**
 * INSERIES-PROFILE-REDESIGN-01 — "Perfil do espectador" on the public profile. Same 5-step
 * sequence `lib/stats/service.ts` runs before it goes on to compute rankings/growth/goals/etc
 * for the full Stats page — this is the lean subset for a viewer-facing profile card, not a
 * wrapper around `getStatsPageData` (which would also fetch/compute unrelated, unused data).
 * Works for any userId, not just the logged-in user.
 *
 * The title shown is the user's gamification level title (Iniciante/Maratonista/.../Mestre
 * das Series — see lib/gamification/levels.ts) — "o perfil do espectador tem que ser o mesmo
 * que o nome do nivel, mesma logica": one progression name across the whole app, never a
 * second, disconnected classification. `classifyViewerPersona` still supplies the
 * emoji/description (the persona's flavor text is unrelated to level).
 */
export async function getViewerPersonaForUser(userId: string): Promise<ViewerPersona | null> {
  const dataset = await fetchAnalyticsDataset(userId);
  if (dataset.watchedEpisodes.length === 0) return null;

  const overview = computeOverviewStats(dataset);
  const genres = computeGenreStats(dataset.watchedEpisodes);
  const streaks = computeStreakStats(dataset.watchedEpisodes);
  const records = computeFunRecords(dataset);

  const persona = classifyViewerPersona({ overview, genres, streaks, records, dataset });
  const level = await getUserLevel(userId);

  return level ? { ...persona, title: level.title } : persona;
}

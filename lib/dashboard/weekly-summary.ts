import { prisma } from "@/lib/db/prisma";
import { addDays, startOfDay } from "@/lib/calendar/dates";

export type DashboardWeeklySummary = {
  episodesWatched: number;
  hoursWatched: number;
  seriesTracked: number;
};

/**
 * Fase 9 (INSERIES-DASHBOARD-AND-MY-LIST-EXPERIENCE-01) — "Resumo semanal" do Dashboard:
 * "apenas episodios assistidos, horas assistidas, series acompanhadas... nunca graficos
 * completos, nunca dashboards analiticos". Deliberadamente NAO reusa `getUserStats`
 * (lib/analytics) - aquele pipeline computa genero favorito, provider predominante, streaks,
 * insights, timeline etc. (usado pela Minha Lista/Estatisticas), muito mais do que 3 numeros
 * simples exigem (Fase 19 - evitar consultas/processamento desnecessario). 2 queries leves,
 * escopadas aos ultimos 7 dias.
 */
export async function getDashboardWeeklySummary(userId: string): Promise<DashboardWeeklySummary> {
  const weekStart = startOfDay(addDays(new Date(), -6));

  const [watchedThisWeek, seriesTracked] = await Promise.all([
    prisma.userEpisodeProgress.findMany({
      where: { userId, watched: true, watchedAt: { gte: weekStart } },
      select: { episode: { select: { runtimeMinutes: true } } }
    }),
    prisma.userSeriesStatus.count({ where: { userId, state: { in: ["WATCHING", "WANT_TO_WATCH", "PAUSED"] } } })
  ]);

  const minutesWatched = watchedThisWeek.reduce((sum, row) => sum + (row.episode.runtimeMinutes ?? 0), 0);

  return {
    episodesWatched: watchedThisWeek.length,
    hoursWatched: Math.round((minutesWatched / 60) * 10) / 10,
    seriesTracked
  };
}

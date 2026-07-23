import { diffInCalendarDays, formatShortDate } from "@/lib/calendar/dates";
import type { TrackedSeriesState } from "@/lib/tracked-series/types";

const ONGOING_SERIES_STATUSES = new Set(["RETURNING", "IN_PRODUCTION", "PILOT"]);

export type ClassifiableEpisode = { airedAt: Date | null; watched: boolean };

/**
 * Fase 10 (INSERIES-DASHBOARD-OPERATIONAL-EXPERIENCE-04) — a regra pura por tras de "Series
 * acompanhadas": dado os episodios de 1 serie + o status do ciclo de vida dela no catalogo,
 * decide qual dos 5 estados (disponivel/proximo-episodio/aguardando-temporada/concluida)
 * mostrar. Extraida de lib/tracked-series/queries.ts pra ser testavel sem banco - mesmo
 * padrao de lib/dashboard/group-by-series.ts e dedupe.ts (query busca dado, funcao pura
 * decide apresentacao).
 */
export function classifyTrackedSeries(
  episodes: ClassifiableEpisode[],
  seriesLifecycleStatus: string,
  now: Date
): { state: TrackedSeriesState; stateLabel: string; contextLabel: string | null } {
  const airedUnwatchedCount = episodes.filter((episode) => episode.airedAt !== null && episode.airedAt <= now && !episode.watched).length;
  const nextUpcoming = episodes.find((episode) => episode.airedAt !== null && episode.airedAt > now) ?? null;

  if (airedUnwatchedCount > 0) {
    return {
      state: "disponivel",
      stateLabel: `${airedUnwatchedCount} episodio${airedUnwatchedCount > 1 ? "s" : ""} ${airedUnwatchedCount > 1 ? "disponiveis" : "disponivel"}`,
      contextLabel: null
    };
  }

  if (nextUpcoming) {
    const airedAt = nextUpcoming.airedAt as Date;
    const days = diffInCalendarDays(airedAt, now);
    return {
      state: "proximo-episodio",
      stateLabel: days === 0 ? "Estreia hoje" : days === 1 ? "Proximo episodio amanha" : `Proximo episodio em ${days} dias`,
      contextLabel: formatShortDate(airedAt)
    };
  }

  if (ONGOING_SERIES_STATUSES.has(seriesLifecycleStatus)) {
    return { state: "aguardando-temporada", stateLabel: "Aguardando nova temporada", contextLabel: null };
  }

  return { state: "concluida", stateLabel: "Temporada concluida", contextLabel: null };
}

import type { ContinueWatchingItem } from "@/lib/continue-watching";
import type { CalendarEpisode } from "@/lib/calendar/queries";

/**
 * Fase 7 (INSERIES-DASHBOARD-HOME-EXPERIENCE-03) — regra de exclusividade: um episodio so
 * pode aparecer numa secao operacional principal do Dashboard. `sinceLastVisit`/`overdue` (
 * getDashboardCalendarData) e `continueWatching.episode` (getWatchNextForUser, via
 * getContinueWatchingForUser) usam o mesmo predicado base (episodio ja no ar, nao assistido,
 * serie WATCHING/WANT_TO_WATCH) — o mesmo episodio pode legitimamente aparecer nos dois.
 * Prioridade: Continuar Assistindo > Novos para voce (sinceLastVisit) > Pendencias (overdue).
 * `upcoming` nunca precisa de dedupe aqui: e sempre `airedAt > now`, e o episodio de
 * Continuar Assistindo e sempre `airedAt <= now` (proximo episodio JA no ar) — as duas listas
 * sao mutuamente exclusivas por construcao de data.
 */
export function dedupeDashboardEpisodes({
  continueWatching,
  sinceLastVisit,
  overdue
}: {
  continueWatching: ContinueWatchingItem[];
  sinceLastVisit: CalendarEpisode[];
  overdue: CalendarEpisode[];
}): { sinceLastVisit: CalendarEpisode[]; overdue: CalendarEpisode[] } {
  const continueWatchingEpisodeIds = new Set(continueWatching.map((item) => item.episode.id));

  return {
    sinceLastVisit: sinceLastVisit.filter((episode) => !continueWatchingEpisodeIds.has(episode.id)),
    overdue: overdue.filter((episode) => !continueWatchingEpisodeIds.has(episode.id))
  };
}

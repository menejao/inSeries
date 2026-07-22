import type { ContinueWatchingItem } from "@/lib/continue-watching";

/**
 * Fase 4/9 (INSERIES-DASHBOARD-OPERATIONAL-EXPERIENCE-04) — "episodios com 0% nao devem
 * aparecer como Continuar assistindo". `getContinueWatchingForUser` inclui qualquer serie
 * WATCHING/WANT_TO_WATCH com episodio pendente, mesmo que o usuario nunca tenha assistido
 * nada dela (`seriesProgressPercent` vem de `UserSeriesStatus.completionPercent`, que so sobe
 * depois do primeiro episodio marcado). Essa funcao separa quem já tem alguma continuidade
 * real (`started`, elegivel a Hero/lista secundaria) de quem ainda nao comecou (`notStarted`).
 *
 * Nao precisa "reclassificar" `notStarted` em nenhum outro lugar: o episodio dele ja esta em
 * `overdue`/`sinceLastVisit` (mesmo predicado base: episodio no ar, nao assistido, serie
 * WATCHING/WANT_TO_WATCH) - só nao aparecia la porque `dedupeDashboardEpisodes` excluia
 * qualquer episodio presente em `continueWatching`. O chamador so precisa passar `started`
 * (nao a lista completa) pro dedupe, e o item reaparece sozinho em Pendencias/Novos.
 */
export function splitContinueWatchingByProgress(items: ContinueWatchingItem[]): {
  started: ContinueWatchingItem[];
  notStarted: ContinueWatchingItem[];
} {
  const started: ContinueWatchingItem[] = [];
  const notStarted: ContinueWatchingItem[] = [];

  for (const item of items) {
    if (item.seriesProgressPercent > 0) {
      started.push(item);
    } else {
      notStarted.push(item);
    }
  }

  return { started, notStarted };
}

import type { CalendarEpisode } from "@/lib/calendar/queries";

export type AvailableNowGroup = {
  series: CalendarEpisode["series"];
  episodes: CalendarEpisode[];
  count: number;
  /** "T0XEyy ate T0XEzz" only when every episode in the group shares the same season — Fase 8: "informar o intervalo, quando possivel". */
  rangeLabel: string | null;
  /** Oldest unwatched episode of the group — the one "Continuar serie" links to. */
  nextEpisode: CalendarEpisode;
};

function formatEpisodeCode(seasonNumber: number, episodeNumber: number) {
  return `T${String(seasonNumber).padStart(2, "0")}E${String(episodeNumber).padStart(2, "0")}`;
}

/**
 * Fase 8 (INSERIES-DASHBOARD-OPERATIONAL-EXPERIENCE-04) — "Pendencias" listava um
 * `EpisodeActionRow` por episodio individual, repetindo poster/titulo da mesma serie varias
 * vezes (achado real na Fase 1: usuario com 5 episodios atrasados da mesma serie via 5 linhas
 * identicas). Agrupa por serie, preservando a ordem de chegada de `overdue` (ja vem ordenado
 * por urgencia pela query de origem - o primeiro episodio de cada grupo e o mais antigo, logo
 * o grupo aparece na posicao do episodio mais urgente que ele contem).
 */
export function groupOverdueBySeries(overdue: CalendarEpisode[]): AvailableNowGroup[] {
  const groups: AvailableNowGroup[] = [];
  const groupBySeriesId = new Map<string, AvailableNowGroup>();

  for (const episode of overdue) {
    let group = groupBySeriesId.get(episode.series.id);
    if (!group) {
      group = { series: episode.series, episodes: [], count: 0, rangeLabel: null, nextEpisode: episode };
      groupBySeriesId.set(episode.series.id, group);
      groups.push(group);
    }
    group.episodes.push(episode);
  }

  for (const group of groups) {
    group.episodes.sort((a, b) => (a.seasonNumber - b.seasonNumber) || (a.number - b.number));
    group.count = group.episodes.length;
    group.nextEpisode = group.episodes[0];

    const seasons = new Set(group.episodes.map((episode) => episode.seasonNumber));
    if (seasons.size === 1 && group.episodes.length > 1) {
      const first = group.episodes[0];
      const last = group.episodes[group.episodes.length - 1];
      group.rangeLabel = `${formatEpisodeCode(first.seasonNumber, first.number)} ate ${formatEpisodeCode(last.seasonNumber, last.number)}`;
    }
  }

  return groups;
}

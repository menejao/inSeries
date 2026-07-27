import type { CalendarEpisode, FutureSeason } from "@/lib/calendar/queries";
import { isSameDay } from "@/lib/calendar/dates";

const WEEKDAY_LABELS = ["Domingo", "Segunda", "Terca", "Quarta", "Quinta", "Sexta", "Sabado"];

export type CalendarDayGroup = {
  key: string;
  label: string;
  episodes: CalendarEpisode[];
};

/**
 * Fase 7 (INSERIES-CALENDAR-EXPERIENCE-01) — "Esta semana": "agrupar visualmente por dia...
 * Segunda: Rick and Morty / Terca: The Bear / Quinta: Silo". Funcao pura, testavel
 * isoladamente: recebe a lista ja filtrada/ordenada (`thisWeek`, de
 * `getPersonalCalendarSections`) e so agrupa por dia do calendario, preservando a ordem
 * cronologica ja existente.
 */
export function groupByWeekday(episodes: CalendarEpisode[]): CalendarDayGroup[] {
  const groups: CalendarDayGroup[] = [];
  const groupByKey = new Map<string, CalendarDayGroup>();

  for (const episode of episodes) {
    const key = episode.airedAt.toDateString();
    let group = groupByKey.get(key);
    if (!group) {
      group = { key, label: WEEKDAY_LABELS[episode.airedAt.getDay()], episodes: [] };
      groupByKey.set(key, group);
      groups.push(group);
    }
    group.episodes.push(episode);
  }

  return groups;
}

export type FutureSeasonYearGroup = {
  key: string;
  label: string;
  seasons: FutureSeason[];
};

/**
 * Fase 9 — "Temporadas futuras" agrupadas por ano ("Quando existir apenas previsao de ano:
 * exibir somente o ano. Nao inventar datas") - o schema so guarda `airYear` (sem mes), entao
 * nunca ha subgrupo por mes pra inventar; "sem previsao" vira seu proprio grupo, sempre por
 * ultimo.
 */
export function groupFutureSeasonsByYear(seasons: FutureSeason[]): FutureSeasonYearGroup[] {
  const withYear = seasons.filter((season) => season.airYear !== null).sort((a, b) => (a.airYear as number) - (b.airYear as number));
  const withoutYear = seasons.filter((season) => season.airYear === null);

  const groups: FutureSeasonYearGroup[] = [];
  const groupByYear = new Map<number, FutureSeasonYearGroup>();

  for (const season of withYear) {
    const year = season.airYear as number;
    let group = groupByYear.get(year);
    if (!group) {
      group = { key: String(year), label: String(year), seasons: [] };
      groupByYear.set(year, group);
      groups.push(group);
    }
    group.seasons.push(season);
  }

  if (withoutYear.length) {
    groups.push({ key: "sem-previsao", label: "Sem previsao", seasons: withoutYear });
  }

  return groups;
}

export type CalendarEpisodeStatus = "hoje" | "atrasado" | "em-breve" | "assistido";

/**
 * Fase 11 — status temporal do episodio (distinto do status de acompanhamento da serie,
 * que ja aparecia em outro badge antes desta sprint - "evitar excesso de badges" significa
 * mostrar so 1). `watched` sempre vence (Fase 5: "priorizar episodios ainda nao assistidos",
 * mas quando ja assistido, o usuario quer ver isso confirmado, nao a urgencia original).
 */
export function getCalendarEpisodeStatus(episode: CalendarEpisode, now: Date): CalendarEpisodeStatus {
  if (episode.watched) return "assistido";
  if (isSameDay(episode.airedAt, now)) return "hoje";
  if (episode.airedAt < now) return "atrasado";
  return "em-breve";
}

import { addDays, isSameDay, startOfDay } from "@/lib/calendar/dates";
import type { CalendarEpisode } from "@/lib/calendar/queries";

export type AgendaGroupKey = "hoje" | "amanha" | "estaSemana" | "proximaSemana";

export type AgendaGroup = {
  key: AgendaGroupKey;
  label: string;
  episodes: CalendarEpisode[];
  hiddenCount: number;
};

const MAX_VISIBLE_EPISODES = 4;
const LABELS: Record<AgendaGroupKey, string> = {
  hoje: "Hoje",
  amanha: "Amanha",
  estaSemana: "Esta semana",
  proximaSemana: "Proxima semana"
};

/**
 * Fase 7 (INSERIES-DASHBOARD-AND-MY-LIST-EXPERIENCE-01) — "Proximos episodios" agrupado por
 * Hoje/Amanha/Esta semana/Proxima semana (era so ate "esta semana"). `upcoming` ja vem sem
 * corte de data (so `airedAt > now`, capado por CONTAGEM em 15 itens em
 * `getDashboardCalendarData`), entao o bucket adicional nao precisa de nenhuma query nova -
 * so mais uma janela de data sobre o mesmo array.
 */
export function groupUpcomingForAgenda(upcoming: CalendarEpisode[]): AgendaGroup[] {
  const now = new Date();
  const today = startOfDay(now);
  const tomorrow = addDays(today, 1);
  const weekEnd = addDays(today, 7);
  const nextWeekEnd = addDays(today, 14);

  const buckets: Record<AgendaGroupKey, CalendarEpisode[]> = {
    hoje: upcoming.filter((episode) => isSameDay(episode.airedAt, now)),
    amanha: upcoming.filter((episode) => isSameDay(episode.airedAt, tomorrow)),
    estaSemana: upcoming.filter((episode) => episode.airedAt > tomorrow && episode.airedAt <= weekEnd),
    proximaSemana: upcoming.filter((episode) => episode.airedAt > weekEnd && episode.airedAt <= nextWeekEnd)
  };

  const groups: AgendaGroup[] = (["hoje", "amanha", "estaSemana", "proximaSemana"] as const)
    .map((key) => ({ key, label: LABELS[key], episodes: buckets[key], hiddenCount: 0 }))
    .filter((group) => group.episodes.length > 0);

  let remaining = MAX_VISIBLE_EPISODES;
  for (const group of groups) {
    if (group.episodes.length > remaining) {
      group.hiddenCount = group.episodes.length - remaining;
      group.episodes = group.episodes.slice(0, remaining);
      remaining = 0;
    } else {
      remaining -= group.episodes.length;
    }
  }

  return groups;
}

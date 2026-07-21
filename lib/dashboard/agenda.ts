import { addDays, isSameDay, startOfDay } from "@/lib/calendar/dates";
import type { CalendarEpisode } from "@/lib/calendar/queries";

export type AgendaGroupKey = "hoje" | "amanha" | "estaSemana";

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
  estaSemana: "Esta semana"
};

/**
 * Fase 7/8 (INSERIES-DASHBOARD-HOME-EXPERIENCE-03) — "Agenda resumida" nunca deve virar uma
 * copia do calendario: agrupa `upcoming` (sempre `airedAt > now`, ja filtrado por series
 * acompanhadas em getDashboardCalendarData) em hoje/amanha/esta semana (proximos 7 dias),
 * limita a no maximo 4 episodios visiveis no total — quando um grupo estoura o restante do
 * orcamento, o excedente vira `hiddenCount` (renderizado como "+N mais" pelo componente, sem
 * criar mais uma lista longa).
 */
export function groupUpcomingForAgenda(upcoming: CalendarEpisode[]): AgendaGroup[] {
  const now = new Date();
  const today = startOfDay(now);
  const tomorrow = addDays(today, 1);
  const weekEnd = addDays(today, 7);

  const buckets: Record<AgendaGroupKey, CalendarEpisode[]> = {
    hoje: upcoming.filter((episode) => isSameDay(episode.airedAt, now)),
    amanha: upcoming.filter((episode) => isSameDay(episode.airedAt, tomorrow)),
    estaSemana: upcoming.filter((episode) => episode.airedAt > tomorrow && episode.airedAt <= weekEnd)
  };

  const groups: AgendaGroup[] = (["hoje", "amanha", "estaSemana"] as const)
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

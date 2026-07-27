import { PersonalCalendarBody } from "@/components/calendar/personal-calendar-body";
import { EmptyState } from "@/components/ui/empty-state";
import { CalendarIcon } from "@/components/ui/icons";
import { getPersonalCalendarSections } from "@/lib/calendar/queries";
import { groupByWeekday, groupFutureSeasonsByYear } from "@/lib/calendar/personal-sections";

/**
 * INSERIES-CALENDAR-EXPERIENCE-01 — reorganizacao cronologica completa. Ordem antiga (Hoje,
 * Esta Semana, Proximos Lancamentos, Temporadas Futuras, Atrasados, Assistidos Recentemente)
 * misturava passado/presente/futuro sem hierarquia; nova ordem segue a urgencia temporal:
 * Hoje (Fase 5) -> Atrasados (Fase 6, "uma das acoes mais importantes da pagina, logo apos
 * Hoje") -> Esta semana, agrupada por dia (Fase 7) -> Proximos lancamentos (Fase 8) ->
 * Temporadas futuras, agrupadas por ano (Fase 9). "Assistidos recentemente" removida por
 * completo (Fase 16 - historico de atividade pertence ao Feed/Perfil, nao ao Calendario).
 *
 * Fase 13 — filtros de Estado/Periodo (auto-apply, sem query ao servidor) vivem em
 * `PersonalCalendarBody` (client), que recebe os dados ja buscados aqui e filtra em memoria —
 * o dataset de um calendario pessoal e pequeno o bastante pra isso ser instantaneo, sem round
 * trip nenhum ao trocar de filtro.
 */
export async function PersonalCalendar({ userId }: { userId: string }) {
  const sections = await getPersonalCalendarSections(userId);
  const weekGroups = groupByWeekday(sections.thisWeek);
  const futureSeasonGroups = groupFutureSeasonsByYear(sections.futureSeasons);

  const isEmpty =
    !sections.today.length &&
    !sections.overdue.length &&
    !sections.thisWeek.length &&
    !sections.upcoming.length &&
    !sections.futureSeasons.length;

  if (isEmpty) {
    return (
      <EmptyState
        icon={<CalendarIcon className="h-6 w-6" aria-hidden />}
        title="Nada por aqui ainda"
        copy="Acompanhe series pra ver episodios lancados, proximos lancamentos e temporadas futuras aqui."
      />
    );
  }

  return (
    <PersonalCalendarBody
      today={sections.today}
      overdue={sections.overdue}
      upcoming={sections.upcoming}
      thisWeekCount={sections.thisWeek.length}
      futureSeasonsCount={sections.futureSeasons.length}
      weekGroups={weekGroups}
      futureSeasonGroups={futureSeasonGroups}
    />
  );
}

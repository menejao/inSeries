import { CalendarSection } from "@/components/calendar/calendar-section";
import { CalendarSummary } from "@/components/calendar/calendar-summary";
import { EpisodeCalendarCard } from "@/components/calendar/episode-calendar-card";
import { FutureSeasonCard } from "@/components/calendar/future-season-card";
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
    <div className="space-y-8">
      <CalendarSummary
        today={sections.today.length}
        thisWeek={sections.thisWeek.length}
        overdue={sections.overdue.length}
        futureSeasons={sections.futureSeasons.length}
      />

      {/* Fase 5 — "Hoje" e a mais importante: destaque visual proprio (nao so mais uma CalendarSection igual as outras). */}
      {sections.today.length ? (
        <section id="calendario-hoje" className="scroll-mt-24 space-y-3">
          <h2 className="flex items-center gap-2 text-xl font-semibold text-ink">
            <span className="h-2 w-2 shrink-0 rounded-full bg-primary" aria-hidden />
            Hoje
          </h2>
          <div className="space-y-3">
            {sections.today.map((episode) => (
              <EpisodeCalendarCard key={episode.id} episode={episode} authenticated status="hoje" />
            ))}
          </div>
        </section>
      ) : null}

      <CalendarSection
        title="Atrasados"
        items={sections.overdue}
        initialVisible={5}
        renderItem={(episode) => <EpisodeCalendarCard key={episode.id} episode={episode} authenticated status="atrasado" />}
      />

      {/* Fase 7 — "Esta semana" agrupada visualmente por dia, nao uma lista continua sem contexto. */}
      {weekGroups.length ? (
        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-ink">Esta semana</h2>
          <div className="space-y-4">
            {weekGroups.map((group) => (
              <div key={group.key} className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-subtle">{group.label}</p>
                <div className="space-y-3">
                  {group.episodes.map((episode) => (
                    <EpisodeCalendarCard key={episode.id} episode={episode} authenticated status="em-breve" />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <CalendarSection
        title="Proximos lancamentos"
        items={sections.upcoming}
        initialVisible={5}
        renderItem={(episode) => <EpisodeCalendarCard key={episode.id} episode={episode} authenticated status="em-breve" />}
      />

      {/* Fase 9 — "Temporadas futuras" agrupada por ano, separada dos episodios (secao propria, composicao diferente). */}
      {futureSeasonGroups.length ? (
        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-ink">Temporadas futuras</h2>
          <div className="space-y-4">
            {futureSeasonGroups.map((group) => (
              <div key={group.key} className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-subtle">{group.label}</p>
                <div className="space-y-3">
                  {group.seasons.map((season) => (
                    <FutureSeasonCard key={season.seasonId} season={season} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

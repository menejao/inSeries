"use client";

import { useMemo, useState } from "react";
import { CalendarSection } from "@/components/calendar/calendar-section";
import { CalendarSummary } from "@/components/calendar/calendar-summary";
import { CalendarMonthView } from "@/components/calendar/calendar-month-view";
import { EpisodeCalendarCard } from "@/components/calendar/episode-calendar-card";
import { FutureSeasonCard } from "@/components/calendar/future-season-card";
import {
  PersonalCalendarFilters,
  type PersonalCalendarSectionFilter,
  type PersonalCalendarStateFilter
} from "@/components/calendar/personal-calendar-filters";
import { cn } from "@/lib/utils";
import type { CalendarEpisode } from "@/lib/calendar/queries";
import type { CalendarDayGroup, FutureSeasonYearGroup } from "@/lib/calendar/personal-sections";

function filterByState(episodes: CalendarEpisode[], stateFilter: PersonalCalendarStateFilter) {
  if (stateFilter === "ALL") return episodes;
  return episodes.filter((episode) => episode.userState === stateFilter);
}

export function PersonalCalendarBody({
  today,
  overdue,
  upcoming,
  thisWeekCount,
  futureSeasonsCount,
  weekGroups,
  futureSeasonGroups
}: {
  today: CalendarEpisode[];
  overdue: CalendarEpisode[];
  upcoming: CalendarEpisode[];
  thisWeekCount: number;
  futureSeasonsCount: number;
  weekGroups: CalendarDayGroup[];
  futureSeasonGroups: FutureSeasonYearGroup[];
}) {
  const [stateFilter, setStateFilter] = useState<PersonalCalendarStateFilter>("ALL");
  const [sectionFilter, setSectionFilter] = useState<PersonalCalendarSectionFilter>("ALL");
  const [viewMode, setViewMode] = useState<"lista" | "mes">("lista");

  const filteredToday = useMemo(() => filterByState(today, stateFilter), [today, stateFilter]);
  const filteredOverdue = useMemo(() => filterByState(overdue, stateFilter), [overdue, stateFilter]);
  const filteredUpcoming = useMemo(() => filterByState(upcoming, stateFilter), [upcoming, stateFilter]);
  const filteredWeekGroups = useMemo(
    () =>
      weekGroups
        .map((group) => ({ ...group, episodes: filterByState(group.episodes, stateFilter) }))
        .filter((group) => group.episodes.length),
    [weekGroups, stateFilter]
  );

  const monthEpisodes = useMemo(
    () => [...filteredToday, ...filteredOverdue, ...filteredUpcoming, ...filteredWeekGroups.flatMap((group) => group.episodes)],
    [filteredToday, filteredOverdue, filteredUpcoming, filteredWeekGroups]
  );

  const showToday = sectionFilter === "ALL" || sectionFilter === "hoje";
  const showOverdue = sectionFilter === "ALL" || sectionFilter === "atrasados";
  const showWeek = sectionFilter === "ALL" || sectionFilter === "esta-semana";
  const showUpcomingAndFuture = sectionFilter === "ALL";

  return (
    <div className="space-y-8">
      <CalendarSummary today={today.length} thisWeek={thisWeekCount} overdue={overdue.length} futureSeasons={futureSeasonsCount} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <PersonalCalendarFilters stateFilter={stateFilter} sectionFilter={sectionFilter} onStateChange={setStateFilter} onSectionChange={setSectionFilter} />
        {/* Fase 14 — modo mensal complementar, Lista continua sendo o padrao. */}
        <div className="flex items-center gap-1 rounded-full border border-border bg-surface p-1" role="tablist" aria-label="Modo de visualizacao">
          <button
            type="button"
            role="tab"
            aria-selected={viewMode === "lista"}
            onClick={() => setViewMode("lista")}
            className={cn("min-h-8 rounded-full px-3.5 text-sm font-medium transition", viewMode === "lista" ? "bg-primary/10 text-primary-text" : "text-muted hover:text-ink")}
          >
            Lista
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={viewMode === "mes"}
            onClick={() => setViewMode("mes")}
            className={cn("min-h-8 rounded-full px-3.5 text-sm font-medium transition", viewMode === "mes" ? "bg-primary/10 text-primary-text" : "text-muted hover:text-ink")}
          >
            Mes
          </button>
        </div>
      </div>

      {viewMode === "mes" ? <CalendarMonthView episodes={monthEpisodes} /> : null}

      {viewMode === "lista" && showToday && filteredToday.length ? (
        <section id="calendario-hoje" className="scroll-mt-24 space-y-3">
          <h2 className="flex items-center gap-2 text-xl font-semibold text-ink">
            <span className="h-2 w-2 shrink-0 rounded-full bg-primary" aria-hidden />
            Hoje
          </h2>
          <div className="space-y-3">
            {filteredToday.map((episode) => (
              <EpisodeCalendarCard key={episode.id} episode={episode} authenticated status="hoje" />
            ))}
          </div>
        </section>
      ) : null}

      {viewMode === "lista" && showOverdue ? (
        <CalendarSection
          title="Atrasados"
          items={filteredOverdue}
          initialVisible={5}
          renderItem={(episode) => <EpisodeCalendarCard key={episode.id} episode={episode} authenticated status="atrasado" />}
        />
      ) : null}

      {viewMode === "lista" && showWeek && filteredWeekGroups.length ? (
        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-ink">Esta semana</h2>
          <div className="space-y-4">
            {filteredWeekGroups.map((group) => (
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

      {viewMode === "lista" && showUpcomingAndFuture ? (
        <CalendarSection
          title="Proximos lancamentos"
          items={filteredUpcoming}
          initialVisible={5}
          renderItem={(episode) => <EpisodeCalendarCard key={episode.id} episode={episode} authenticated status="em-breve" />}
        />
      ) : null}

      {viewMode === "lista" && showUpcomingAndFuture && futureSeasonGroups.length ? (
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

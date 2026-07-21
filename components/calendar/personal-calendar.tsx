import { CalendarSection } from "@/components/calendar/calendar-section";
import { EpisodeCalendarCard } from "@/components/calendar/episode-calendar-card";
import { FutureSeasonCard } from "@/components/calendar/future-season-card";
import { getPersonalCalendarSections } from "@/lib/calendar/queries";

export async function PersonalCalendar({ userId }: { userId: string }) {
  const sections = await getPersonalCalendarSections(userId);

  return (
    <div className="space-y-8">
      <CalendarSection
        title="Hoje"
        items={sections.today}
        emptyTitle="Nada lancado hoje"
        emptyCopy="Nenhum episodio das suas series estreia hoje."
        renderItem={(episode) => <EpisodeCalendarCard key={episode.id} episode={episode} authenticated />}
      />
      <CalendarSection
        title="Esta Semana"
        items={sections.thisWeek}
        emptyTitle="Nada previsto para esta semana"
        emptyCopy="Nenhum episodio novo previsto para os proximos dias."
        renderItem={(episode) => <EpisodeCalendarCard key={episode.id} episode={episode} authenticated />}
      />
      <CalendarSection
        title="Proximos Lancamentos"
        items={sections.upcoming}
        emptyTitle="Sem lancamentos futuros"
        emptyCopy="Nao ha episodios futuros conhecidos para suas series no momento."
        renderItem={(episode) => <EpisodeCalendarCard key={episode.id} episode={episode} authenticated />}
        initialVisible={5}
      />
      <CalendarSection
        title="Temporadas Futuras"
        items={sections.futureSeasons}
        emptyTitle="Nenhuma temporada futura anunciada"
        emptyCopy="Quando uma nova temporada for anunciada, ela aparece aqui."
        renderItem={(season) => <FutureSeasonCard key={season.seasonId} season={season} />}
      />
      <CalendarSection
        title="Atrasados"
        items={sections.overdue}
        emptyTitle="Tudo em dia"
        emptyCopy="Voce nao tem episodios ja lancados pendentes de assistir."
        renderItem={(episode) => <EpisodeCalendarCard key={episode.id} episode={episode} authenticated />}
        initialVisible={5}
      />
      <CalendarSection
        title="Assistidos Recentemente"
        items={sections.recentlyWatched}
        emptyTitle="Nada assistido nos ultimos dias"
        emptyCopy="Episodios marcados como assistidos recentemente aparecem aqui."
        renderItem={(episode) => <EpisodeCalendarCard key={episode.id} episode={episode} authenticated />}
        initialVisible={5}
      />
    </div>
  );
}

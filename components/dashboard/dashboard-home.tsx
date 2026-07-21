import Link from "next/link";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { FixedGrid } from "@/components/ui/fixed-grid";
import { EpisodeActionRow } from "@/components/dashboard/episode-action-row";
import { AgendaSummary } from "@/components/dashboard/agenda-summary";
import { ActivityRow } from "@/components/dashboard/activity-row";
import { ContinueWatchingSection } from "@/components/continue-watching/continue-watching-section";
import { AlertCircleIcon, BellIcon, CalendarIcon, CheckCircleIcon, FilmIcon, TvIcon } from "@/components/ui/icons";
import { getDashboardCalendarData } from "@/lib/calendar/queries";
import { getRecentActivityForUser } from "@/lib/social/activity";
import { getContinueWatchingForUser } from "@/lib/continue-watching";
import { dedupeDashboardEpisodes } from "@/lib/dashboard/dedupe";
import { groupUpcomingForAgenda } from "@/lib/dashboard/agenda";
import { cn, formatRelativeDate } from "@/lib/utils";
import type { User } from "@prisma/client";

const SHORTCUTS = [
  { icon: CalendarIcon, label: "Calendario", href: "/calendar" },
  { icon: FilmIcon, label: "Feed", href: "/feed" },
  { icon: CheckCircleIcon, label: "Marcar episodio", href: "/watch-next" },
  { icon: TvIcon, label: "Series acompanhadas", href: "/me/watching" }
] as const;

/**
 * Fase 6/9/10 (INSERIES-DASHBOARD-HOME-EXPERIENCE-03) — limite de itens visiveis por
 * breakpoint (3 mobile / 4 tablet / 5 desktop) sem esconder a lista inteira em RSC: os 2
 * ultimos itens (indices 3 e 4) ganham `hidden sm:block`/`hidden lg:block`. `gap` (nao
 * `space-y`) porque elementos `hidden` nao devem herdar margem de irmao anterior.
 */
function responsiveItemVisibility(index: number) {
  if (index === 3) return "hidden sm:block";
  if (index === 4) return "hidden lg:block";
  return undefined;
}

/** Fase 3 — cabecalho contextual: uma frase, nunca metricas decorativas nem gamificacao. */
function getContextualMessage({
  newCount,
  hasContinueWatching,
  pendingCount,
  nextAgendaGroupKey
}: {
  newCount: number;
  hasContinueWatching: boolean;
  pendingCount: number;
  nextAgendaGroupKey: "hoje" | "amanha" | "estaSemana" | null;
}) {
  if (newCount > 0) {
    return `Voce tem ${newCount} episodio${newCount > 1 ? "s" : ""} novo${newCount > 1 ? "s" : ""} desde sua ultima visita.`;
  }
  if (hasContinueWatching) {
    return "Continue de onde parou.";
  }
  if (pendingCount > 0) {
    return `Voce tem ${pendingCount} pendencia${pendingCount > 1 ? "s" : ""} esperando uma acao.`;
  }
  if (nextAgendaGroupKey === "hoje") return "Seu proximo episodio estreia hoje.";
  if (nextAgendaGroupKey === "amanha") return "Seu proximo episodio estreia amanha.";
  return "Nao ha lancamentos pendentes hoje.";
}

export async function DashboardHome({ user }: { user: Pick<User, "id" | "name" | "lastLoginAt"> }) {
  const lastVisitAt = user.lastLoginAt ?? new Date(Date.now() - 24 * 60 * 60 * 1000);
  const firstName = user.name.split(" ")[0];

  const [calendarData, activity, continueWatching] = await Promise.all([
    getDashboardCalendarData(user.id, lastVisitAt),
    getRecentActivityForUser(user.id, 5),
    getContinueWatchingForUser(user.id, { limit: 10 })
  ]);

  // Fase 7 — regra de exclusividade: Continuar Assistindo > Novos para voce > Pendencias > Agenda futura.
  const { sinceLastVisit, overdue } = dedupeDashboardEpisodes({
    continueWatching: continueWatching.items,
    sinceLastVisit: calendarData.sinceLastVisit,
    overdue: calendarData.overdue
  });
  const agendaGroups = groupUpcomingForAgenda(calendarData.upcoming);

  const contextualMessage = getContextualMessage({
    newCount: sinceLastVisit.length,
    hasContinueWatching: continueWatching.items.length > 0,
    pendingCount: overdue.length,
    nextAgendaGroupKey: agendaGroups[0]?.key ?? null
  });

  return (
    <div className="space-y-8">
      <div>
        <p className="eyebrow">Ola, {firstName}</p>
        <p className="section-copy mt-1 text-base text-ink sm:text-lg">{contextualMessage}</p>
      </div>

      <ContinueWatchingSection continueWatching={continueWatching} />

      <section className="space-y-4" aria-label="Novos para voce">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="flex items-center gap-2 text-xl font-semibold text-ink">
              <BellIcon className="h-5 w-5 shrink-0 text-subtle" aria-hidden />
              Novos para voce
            </h2>
            <p className="section-copy mt-1">Episodios de series que voce acompanha, lancados desde sua ultima visita.</p>
          </div>
          <Link href="/calendar" className="link-accent shrink-0 text-sm">
            Ver todos
          </Link>
        </div>
        {sinceLastVisit.length ? (
          <div className="flex flex-col gap-2">
            {sinceLastVisit.map((episode, index) => (
              <div key={episode.id} className={cn(responsiveItemVisibility(index))}>
                <EpisodeActionRow
                  episode={episode}
                  dateLabel={formatRelativeDate(episode.airedAt)}
                  badge={{ label: "Novo", variant: "success" }}
                  action={{ kind: "continue", label: "Assistir", href: `/series/${episode.series.slug}/episode/${episode.id}` }}
                />
              </div>
            ))}
          </div>
        ) : (
          <Card>
            <EmptyState
              icon={<BellIcon className="h-6 w-6" aria-hidden />}
              title="Nenhum episodio novo"
              copy="Quando uma serie que voce acompanha lancar um episodio, ele aparece aqui."
            />
          </Card>
        )}
      </section>

      <section className="space-y-4" aria-label="Agenda resumida">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="flex items-center gap-2 text-xl font-semibold text-ink">
              <CalendarIcon className="h-5 w-5 shrink-0 text-subtle" aria-hidden />
              Agenda resumida
            </h2>
            <p className="section-copy mt-1">O que estreia nos proximos 7 dias.</p>
          </div>
          <Link href="/calendar" className="link-accent shrink-0 text-sm">
            Abrir calendario
          </Link>
        </div>
        {agendaGroups.length ? (
          <AgendaSummary groups={agendaGroups} />
        ) : (
          <Card>
            <EmptyState
              icon={<CalendarIcon className="h-6 w-6" aria-hidden />}
              title="Nenhum lancamento previsto"
              copy="Assim que uma serie que voce acompanha tiver um episodio agendado, ele aparece aqui."
            />
          </Card>
        )}
      </section>

      {overdue.length > 0 ? (
        <section className="space-y-4" aria-label="Pendencias acionaveis">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="flex items-center gap-2 text-xl font-semibold text-ink">
                <AlertCircleIcon className="h-5 w-5 shrink-0 text-subtle" aria-hidden />
                Pendencias
              </h2>
              <p className="section-copy mt-1">Episodios ja lancados que ainda pedem uma acao sua.</p>
            </div>
            <Link href="/calendar" className="link-accent shrink-0 text-sm">
              Ver tudo
            </Link>
          </div>
          <div className="flex flex-col gap-2">
            {overdue.map((episode, index) => (
              <div key={episode.id} className={cn(responsiveItemVisibility(index))}>
                <EpisodeActionRow
                  episode={episode}
                  dateLabel={formatRelativeDate(episode.airedAt)}
                  badge={{ label: "Pendente", variant: "warning" }}
                  action={{ kind: "mark", label: "Marcar como assistido" }}
                />
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section className="space-y-4" aria-label="Atividade recente">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="flex items-center gap-2 text-xl font-semibold text-ink">
              <FilmIcon className="h-5 w-5 shrink-0 text-subtle" aria-hidden />
              Atividade recente
            </h2>
          </div>
          <Link href="/feed" className="link-accent shrink-0 text-sm">
            Ver feed
          </Link>
        </div>
        {activity.length ? (
          <div className="flex flex-col gap-1">
            {activity.map((item, index) => (
              <div key={item.id} className={cn(responsiveItemVisibility(index))}>
                <ActivityRow activity={item} />
              </div>
            ))}
          </div>
        ) : (
          <Card>
            <EmptyState
              icon={<FilmIcon className="h-6 w-6" aria-hidden />}
              title="Nenhuma atividade recente"
              copy="Siga outros usuarios ou marque episodios para ver atividade aqui."
            />
          </Card>
        )}
      </section>

      <section className="space-y-4" aria-label="Atalhos rapidos">
        <h2 className="text-xl font-semibold text-ink">Atalhos rapidos</h2>
        <FixedGrid mobile={2} desktop={4}>
          {SHORTCUTS.map((shortcut) => (
            <Link
              key={shortcut.href}
              href={shortcut.href}
              className="group flex h-full flex-col items-start gap-3 rounded-3xl border border-border bg-surface/70 p-4 transition duration-200 hover:border-primary/40 hover:bg-surface-strong/60 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
            >
              <span
                className="flex h-9 w-9 items-center justify-center rounded-2xl bg-primary/12 text-primary-text transition duration-200 group-hover:bg-primary/20"
                aria-hidden
              >
                <shortcut.icon className="h-4.5 w-4.5" />
              </span>
              <p className="line-clamp-2 min-h-[2.5rem] text-sm font-semibold text-ink">{shortcut.label}</p>
            </Link>
          ))}
        </FixedGrid>
      </section>
    </div>
  );
}

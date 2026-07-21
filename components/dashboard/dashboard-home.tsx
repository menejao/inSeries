import Link from "next/link";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { FixedGrid } from "@/components/ui/fixed-grid";
import { EpisodeCalendarCard } from "@/components/calendar/episode-calendar-card";
import { ActivityCard } from "@/components/feed/activity-card";
import { ContinueWatchingSection } from "@/components/continue-watching/continue-watching-section";
import {
  AlertCircleIcon,
  BellIcon,
  CalendarIcon,
  CompassIcon,
  FilmIcon,
  PlayIcon,
  TvIcon
} from "@/components/ui/icons";
import { getDashboardCalendarData } from "@/lib/calendar/queries";
import { getRecentActivityForUser } from "@/lib/social/activity";
import { getContinueWatchingForUser } from "@/lib/continue-watching";
import type { User } from "@prisma/client";

const SHORTCUTS = [
  { icon: CalendarIcon, label: "Calendario", href: "/calendar" },
  { icon: FilmIcon, label: "Feed", href: "/feed" },
  { icon: PlayIcon, label: "Proximo episodio", href: "/watch-next" },
  { icon: TvIcon, label: "Assistindo", href: "/me/watching" },
  { icon: CompassIcon, label: "Explorar series", href: "/series" }
] as const;

export async function DashboardHome({ user }: { user: Pick<User, "id" | "name" | "lastLoginAt"> }) {
  const lastVisitAt = user.lastLoginAt ?? new Date(Date.now() - 24 * 60 * 60 * 1000);
  const firstName = user.name.split(" ")[0];

  const [calendarData, activity, continueWatching] = await Promise.all([
    getDashboardCalendarData(user.id, lastVisitAt),
    getRecentActivityForUser(user.id, 5),
    getContinueWatchingForUser(user.id, { limit: 10 })
  ]);

  const { sinceLastVisit, upcoming, overdue } = calendarData;

  return (
    <div className="space-y-10">
      <div>
        <p className="eyebrow">Ola, {firstName}</p>
        <h1 className="section-title">Dashboard</h1>
        <p className="section-copy">Veja o que chegou, retome suas series e organize o que assistir hoje.</p>
      </div>

      <ContinueWatchingSection continueWatching={continueWatching} />

      {sinceLastVisit.length > 0 ? (
        <section className="space-y-4" aria-label="Lancados desde sua ultima visita">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="flex items-center gap-2 text-xl font-semibold text-ink">
                <BellIcon className="h-5 w-5 shrink-0 text-subtle" aria-hidden />
                Lancados desde sua ultima visita
              </h2>
              <p className="section-copy mt-1">Episodios que estrearam enquanto voce estava fora.</p>
            </div>
            <Link href="/calendar" className="link-accent shrink-0 text-sm">
              Ver calendario
            </Link>
          </div>
          <div className="space-y-3">
            {sinceLastVisit.map((episode) => (
              <EpisodeCalendarCard key={episode.id} episode={episode} authenticated />
            ))}
          </div>
        </section>
      ) : null}

      <section className="space-y-4" aria-label="Proximos episodios">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="flex items-center gap-2 text-xl font-semibold text-ink">
              <CalendarIcon className="h-5 w-5 shrink-0 text-subtle" aria-hidden />
              Proximos episodios
            </h2>
            <p className="section-copy mt-1">O que estreia em breve nas series que voce acompanha.</p>
          </div>
          <Link href="/calendar" className="link-accent shrink-0 text-sm">
            Ver calendario
          </Link>
        </div>
        {upcoming.length ? (
          <div className="space-y-3">
            {upcoming.map((episode) => (
              <EpisodeCalendarCard key={episode.id} episode={episode} authenticated />
            ))}
          </div>
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
        <section className="space-y-4" aria-label="Pendencias">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="flex items-center gap-2 text-xl font-semibold text-ink">
                <AlertCircleIcon className="h-5 w-5 shrink-0 text-subtle" aria-hidden />
                Pendencias
              </h2>
              <p className="section-copy mt-1">Episodios que ja foram ao ar e voce ainda nao assistiu.</p>
            </div>
            <Link href="/calendar" className="link-accent shrink-0 text-sm">
              Ver tudo
            </Link>
          </div>
          <div className="space-y-3">
            {overdue.map((episode) => (
              <EpisodeCalendarCard key={episode.id} episode={episode} authenticated />
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
            <p className="section-copy mt-1">Suas acoes recentes e o que seus amigos estao assistindo.</p>
          </div>
          <Link href="/feed" className="link-accent shrink-0 text-sm">
            Ver feed
          </Link>
        </div>
        {activity.length ? (
          <div className="space-y-3">
            {activity.map((item) => (
              <ActivityCard key={item.id} activity={item} />
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
        <p className="section-copy">Acesso direto ao que voce usa com mais frequencia.</p>
        <FixedGrid mobile={2} tablet={3} desktop={5}>
          {SHORTCUTS.map((shortcut) => (
            <Link
              key={shortcut.href}
              href={shortcut.href}
              className="group flex flex-col items-start gap-3 rounded-3xl border border-border bg-surface/70 p-4 transition duration-200 hover:border-primary/40 hover:bg-surface-strong/60 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
            >
              <span
                className="flex h-9 w-9 items-center justify-center rounded-2xl bg-primary/12 text-primary-text transition duration-200 group-hover:bg-primary/20"
                aria-hidden
              >
                <shortcut.icon className="h-4.5 w-4.5" />
              </span>
              <p className="text-sm font-semibold text-ink">{shortcut.label}</p>
            </Link>
          ))}
        </FixedGrid>
      </section>
    </div>
  );
}

import Link from "next/link";
import { Card } from "@/components/ui/card";
import { StatTile } from "@/components/stats/stat-tile";
import { InsightList } from "@/components/stats/insight-list";
import { BarList } from "@/components/ui/bar-list";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CalendarIcon, CheckCircleIcon, FilmIcon, ListIcon, SparklesIcon, StarIcon } from "@/components/ui/icons";
import { formatEpisodeCode } from "@/lib/utils";
import type { RecapData } from "@/lib/recap";

export function RecapCard({ recap }: { recap: RecapData }) {
  const genreItems = recap.genres.ranking.slice(0, 5).map((g) => ({ label: g.genre, value: g.episodeCount, percentage: g.percentage }));

  return (
    <div className="space-y-6">
      <Card className="space-y-2 bg-gradient-to-br from-primary/15 via-surface to-surface">
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-primary/15 text-primary-text">
          <SparklesIcon className="h-5 w-5" />
        </span>
        <p className="eyebrow">Seu recap de</p>
        <h1 className="section-title capitalize">{recap.label}</h1>
        <p className="section-copy">
          {recap.episodesWatched > 0
            ? `${recap.episodesWatched} episodio${recap.episodesWatched === 1 ? "" : "s"} assistido${recap.episodesWatched === 1 ? "" : "s"} neste periodo.`
            : "Nenhum episodio assistido neste periodo."}
        </p>
      </Card>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold text-ink">Numeros principais</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile label="Episodios assistidos" value={recap.episodesWatched} />
          <StatTile label="Series assistidas" value={recap.seriesWatchedCount} />
          <StatTile label="Series concluidas" value={recap.seriesCompletedCount} />
          <StatTile label="Dias ativos" value={recap.activeDays} />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="flex items-center gap-2 text-xl font-semibold text-ink">
          <FilmIcon className="h-5 w-5 text-subtle" />
          Tempo assistido
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <StatTile label="Horas assistidas" value={recap.hoursWatched} />
          <StatTile label="Minutos assistidos" value={recap.minutesWatched} />
        </div>
      </section>

      {genreItems.length ? (
        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-ink">Generos</h2>
          <Card>
            <BarList items={genreItems} valueSuffix=" ep." />
          </Card>
        </section>
      ) : null}

      <section className="space-y-3">
        <h2 className="flex items-center gap-2 text-xl font-semibold text-ink">
          <ListIcon className="h-5 w-5 text-subtle" />
          Sequencia
        </h2>
        <StatTile label="Maior sequencia no periodo" value={`${recap.longestStreakDays} dia(s)`} />
      </section>

      {recap.mostWatchedSeries || recap.seriesCompleted.length || recap.mostRecentEpisode ? (
        <section className="space-y-3">
          <h2 className="flex items-center gap-2 text-xl font-semibold text-ink">
            <CheckCircleIcon className="h-5 w-5 text-subtle" />
            Series destaque
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {recap.mostWatchedSeries ? (
              <Card padding="sm">
                <p className="eyebrow">Serie mais assistida</p>
                <p className="mt-2 font-semibold text-ink">{recap.mostWatchedSeries.seriesTitle}</p>
                <p className="text-sm text-muted">{recap.mostWatchedSeries.episodeCount} episodio(s) neste periodo</p>
              </Card>
            ) : null}
            {recap.mostRecentEpisode ? (
              <Card padding="sm">
                <p className="eyebrow">Episodio mais recente</p>
                <p className="mt-2 font-semibold text-ink">{recap.mostRecentEpisode.seriesTitle}</p>
                <p className="text-sm text-muted">
                  {formatEpisodeCode(recap.mostRecentEpisode.seasonNumber, recap.mostRecentEpisode.episodeNumber)} ·{" "}
                  {recap.mostRecentEpisode.episodeTitle}
                </p>
              </Card>
            ) : null}
            {recap.seriesCompleted.length ? (
              <Card padding="sm" className="sm:col-span-2">
                <p className="eyebrow">Series concluidas no periodo</p>
                <p className="mt-2 text-sm text-ink">{recap.seriesCompleted.join(", ")}</p>
              </Card>
            ) : null}
          </div>
        </section>
      ) : null}

      {recap.topReviews.length ? (
        <section className="space-y-3">
          <h2 className="flex items-center gap-2 text-xl font-semibold text-ink">
            <StarIcon className="h-5 w-5 text-subtle" />
            Suas reviews do periodo
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {recap.topReviews.map((review) => (
              <Card key={`${review.seriesId}-${review.createdAt}`} padding="sm">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-semibold text-ink">{review.seriesTitle}</p>
                  <Badge variant="warning">{review.rating}/5</Badge>
                </div>
                <p className="mt-1 line-clamp-2 text-sm text-muted">{review.body}</p>
              </Card>
            ))}
          </div>
        </section>
      ) : null}

      {recap.insights.length ? (
        <section className="space-y-3">
          <h2 className="flex items-center gap-2 text-xl font-semibold text-ink">
            <SparklesIcon className="h-5 w-5 text-subtle" />
            Insights
          </h2>
          <InsightList insights={recap.insights} />
        </section>
      ) : null}

      <section className="space-y-3">
        <h2 className="flex items-center gap-2 text-xl font-semibold text-ink">
          <CalendarIcon className="h-5 w-5 text-subtle" />
          Compartilhamento
        </h2>
        <Card className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-ink">Compartilhamento publico em breve</p>
            <p className="mt-1 text-xs text-subtle">
              Este recap e privado. Um identificador interno ja foi preparado (<code>{recap.sharing.shareSlug}</code>) para uma futura tela
              publica — nada e exposto ainda.
            </p>
          </div>
          <Button variant="secondary" disabled>
            Compartilhar (em breve)
          </Button>
        </Card>
      </section>

      <Link href="/me/recap" className="link-accent text-sm">
        Ver todos os recaps
      </Link>
    </div>
  );
}

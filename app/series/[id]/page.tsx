import Link from "next/link";
import { notFound } from "next/navigation";
import { EpisodeRow } from "@/components/series/episode-row";
import { SeriesStatusActions } from "@/components/series/series-status-actions";
import { ReviewForm } from "@/components/reviews/review-form";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { buttonVariants } from "@/components/ui/button";
import { CalendarIcon, FilmIcon, StarIcon } from "@/components/ui/icons";
import { getCurrentUser } from "@/lib/auth/server";
import { getCatalogSeriesBySlug } from "@/lib/catalog/repository";
import { getStatusBadgeVariant, getStatusLabel } from "@/lib/catalog/status-labels";
import { prisma } from "@/lib/db/prisma";
import { canUseDatabase } from "@/lib/db/health";
import { calculateSeriesProgress } from "@/lib/progress/calculate";
import { getOwnReview, getSeriesReviews } from "@/lib/social/reviews";
import { getNextEpisodeForSeries } from "@/lib/calendar/queries";
import { formatShortDate } from "@/lib/calendar/dates";
import { formatEpisodeCode, getInitials } from "@/lib/utils";

export default async function SeriesDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const series = await getCatalogSeriesBySlug(id);

  if (!series) notFound();

  const user = await getCurrentUser();
  const dbAvailable = await canUseDatabase();
  const status = user && dbAvailable
    ? await prisma.userSeriesStatus.findUnique({
        where: {
          userId_seriesId: {
            userId: user.id,
            seriesId: series.id
          }
        }
      })
    : null;
  const watchedMap = user && dbAvailable
    ? new Set(
        (
          await prisma.userEpisodeProgress.findMany({
            where: {
              userId: user.id,
              episodeId: {
                in: series.seasons.flatMap((season) => season.episodes.map((episode) => episode.id))
              },
              watched: true
            }
          })
        ).map((item) => item.episodeId)
      )
    : new Set<string>();
  const progress = user && dbAvailable ? await calculateSeriesProgress(user.id, series.id) : null;
  const reviews = dbAvailable ? await getSeriesReviews(series.id, user?.id) : [];
  const ownReview = user && dbAvailable ? await getOwnReview(user.id, series.id) : null;
  const nextEpisode = dbAvailable ? await getNextEpisodeForSeries(series.id) : null;

  const hydratedSeasons = series.seasons.map((season) => ({
    ...season,
    episodes: season.episodes.map((episode) => ({
      ...episode,
      watched: watchedMap.has(episode.id)
    }))
  }));

  const totalEpisodes = hydratedSeasons.reduce((sum, item) => sum + item.episodeCount, 0);

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-4xl border border-border">
        <div
          className="min-h-80 bg-cover bg-center p-6 sm:p-8"
          style={{
            backgroundImage: `linear-gradient(180deg, rgb(var(--c-canvas) / 0.25), rgb(var(--c-canvas) / 0.97)), url(${series.backdropUrl || series.posterUrl})`
          }}
        >
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={getStatusBadgeVariant(series.status)}>{getStatusLabel(series.status)}</Badge>
            {typeof series.voteAverage === "number" ? (
              <Badge variant="warning">
                <StarIcon className="h-3 w-3 fill-current" /> {series.voteAverage.toFixed(1)}
              </Badge>
            ) : null}
          </div>
          <h1 className="mt-4 max-w-3xl text-3xl font-black leading-tight text-ink sm:text-4xl">{series.title}</h1>
          {series.originalTitle && series.originalTitle !== series.title ? (
            <p className="mt-1 text-sm text-muted">{series.originalTitle}</p>
          ) : null}
          <p className="mt-4 max-w-3xl text-sm leading-7 text-ink/90">{series.overview}</p>
          <div className="mt-4 flex flex-wrap gap-2 text-xs text-muted">
            {series.genres.map((genre) => (
              <span key={genre} className="rounded-full bg-surface-strong/80 px-2.5 py-1">
                {genre}
              </span>
            ))}
          </div>
          <div className="mt-6">
            <SeriesStatusActions seriesId={series.id} initialState={status?.state ?? null} authenticated={Boolean(user)} />
          </div>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
        <div className="space-y-6">
          <Card className="space-y-4">
            <h2 className="text-lg font-semibold text-ink">Resumo</h2>
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <InfoRow label="Idioma" value={series.language || "Nao informado"} />
              <InfoRow label="Plataforma" value={series.platform || "Nao informado"} />
              <InfoRow label="Temporadas" value={String(hydratedSeasons.length)} />
              <InfoRow label="Episodios" value={String(totalEpisodes)} />
            </dl>
            {user ? (
              <div className="space-y-2 border-t border-border pt-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted">Seu progresso</span>
                  <span className="font-semibold text-ink">{progress?.percentage ?? 0}%</span>
                </div>
                <Progress value={progress?.percentage ?? 0} label="Progresso da serie" />
                <p className="text-xs text-subtle">
                  {progress?.watchedEpisodes ?? 0} de {totalEpisodes} episodios assistidos
                </p>
              </div>
            ) : null}
          </Card>

          <Card className="space-y-3">
            <h2 className="flex items-center gap-2 text-lg font-semibold text-ink">
              <CalendarIcon className="h-5 w-5 text-subtle" />
              Proximo episodio
            </h2>
            {nextEpisode ? (
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-semibold text-ink">
                    {formatEpisodeCode(nextEpisode.seasonNumber, nextEpisode.number)} · {nextEpisode.title}
                  </p>
                  <p className="mt-1 text-sm text-muted">{formatShortDate(nextEpisode.airedAt)}</p>
                  <p className="mt-1 text-xs text-subtle">
                    {nextEpisode.daysRemaining <= 0 ? "Lanca hoje" : `Faltam ${nextEpisode.daysRemaining} dia(s)`}
                  </p>
                </div>
                <Link href="/calendar" className={buttonVariants({ variant: "secondary", size: "sm" })}>
                  Ver calendario
                </Link>
              </div>
            ) : (
              <p className="text-sm text-muted">Serie sem episodios futuros.</p>
            )}
          </Card>
        </div>

        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-ink">Temporadas</h2>
          {hydratedSeasons.length ? (
            hydratedSeasons.map((season) => {
              const watchedInSeason = season.episodes.filter((episode) => episode.watched).length;
              return (
                <Card key={season.id} className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-lg font-semibold text-ink">{season.title}</p>
                      <p className="text-sm text-muted">
                        {season.year || "Ano n/d"} · {season.episodeCount} episodios
                      </p>
                    </div>
                    <Badge variant="outline">Temporada {season.number}</Badge>
                  </div>
                  {user && season.episodeCount > 0 ? (
                    <Progress value={(watchedInSeason / season.episodeCount) * 100} label={`Progresso da temporada ${season.number}`} />
                  ) : null}
                  <div className="space-y-3">
                    {season.episodes.length ? (
                      season.episodes.slice(0, 3).map((episode) => (
                        <EpisodeRow key={episode.id} episode={episode} seasonNumber={season.number} authenticated={Boolean(user)} />
                      ))
                    ) : (
                      <EmptyState title="Episodios nao importados" copy="Temporada existe, mas episodios ainda nao foram sincronizados." />
                    )}
                    {season.episodes.length > 3 ? (
                      <Link href={`/series/${series.slug}/season/${season.number}`} className="link-accent block text-sm">
                        Ver todos os {season.episodes.length} episodios
                      </Link>
                    ) : null}
                  </div>
                </Card>
              );
            })
          ) : (
            <EmptyState title="Temporadas indisponiveis" copy="Serie importada sem temporadas locais ainda." />
          )}
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
        <ReviewForm
          seriesId={series.id}
          authenticated={Boolean(user)}
          initialReview={
            ownReview ? { rating: ownReview.rating, body: ownReview.body, visibility: ownReview.visibility } : null
          }
        />
        <div className="space-y-3">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-ink">
            <FilmIcon className="h-5 w-5 text-subtle" />
            Reviews
          </h2>
          {reviews.length ? (
            reviews.map((review) => (
              <Card key={review.id} className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <Link href={`/profile/${review.user.username}`} className="flex items-center gap-2.5 font-semibold text-ink">
                    <Avatar
                      label={getInitials(review.user.name)}
                      name={review.user.name}
                      src={review.user.avatarUrl}
                      size="sm"
                    />
                    @{review.user.username}
                  </Link>
                  <Badge variant="warning">
                    <StarIcon className="h-3 w-3 fill-current" /> {review.rating}/5
                  </Badge>
                </div>
                <p className="text-sm text-muted">{review.body}</p>
                {user && review.userId === user.id && review.visibility !== "PUBLIC" ? (
                  <Badge variant="default">Somente voce</Badge>
                ) : null}
              </Card>
            ))
          ) : (
            <EmptyState title="Nenhuma review ainda" copy="Seja o primeiro a avaliar esta serie." />
          )}
        </div>
      </section>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-subtle">{label}</dt>
      <dd className="mt-0.5 font-medium text-ink">{value}</dd>
    </div>
  );
}

import Link from "next/link";
import { notFound } from "next/navigation";
import { EpisodeRow } from "@/components/series/episode-row";
import { SeriesStatusActions } from "@/components/series/series-status-actions";
import { ReviewForm } from "@/components/reviews/review-form";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { getCurrentUser } from "@/lib/auth/server";
import { getCatalogSeriesBySlug } from "@/lib/catalog/repository";
import { prisma } from "@/lib/db/prisma";
import { canUseDatabase } from "@/lib/db/health";
import { calculateSeriesProgress } from "@/lib/progress/calculate";
import { getOwnReview, getSeriesReviews } from "@/lib/social/reviews";
import { getNextEpisodeForSeries } from "@/lib/calendar/queries";
import { formatShortDate } from "@/lib/calendar/dates";
import { formatEpisodeCode } from "@/lib/utils";

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

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-[2rem] border border-white/10">
        <div
          className="min-h-72 bg-cover bg-center p-6 sm:p-8"
          style={{
            backgroundImage: `linear-gradient(rgba(16,24,40,0.35), rgba(16,24,40,0.96)), url(${series.backdropUrl || series.posterUrl})`
          }}
        >
          <Badge>{series.status}</Badge>
          <h1 className="mt-4 text-4xl font-black text-ink">{series.title}</h1>
          <p className="mt-1 text-sm text-slate-300">{series.originalTitle}</p>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-200">{series.overview}</p>
          <div className="mt-6">
            <SeriesStatusActions seriesId={series.id} initialState={status?.state ?? null} authenticated={Boolean(user)} />
          </div>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
        <Card>
          <h2 className="text-xl font-semibold text-ink">Resumo</h2>
          <div className="mt-4 grid gap-3 text-sm text-slate-300">
            <p>Generos: {series.genres.join(", ") || "Nao informado"}</p>
            <p>Idioma: {series.language || "Nao informado"}</p>
            <p>Plataforma: {series.platform || "Nao informado"}</p>
            <p>Temporadas: {hydratedSeasons.length}</p>
            <p>Episodios: {hydratedSeasons.reduce((sum, item) => sum + item.episodeCount, 0)}</p>
            <p>Assistidos: {progress?.watchedEpisodes ?? 0}</p>
            <p>Progresso: {progress?.percentage ?? 0}%</p>
            <p>Proximo episodio: {progress?.nextEpisode ? `${progress.nextEpisode.title}` : "Nenhum"}</p>
          </div>
        </Card>
        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-ink">Temporadas</h2>
          {hydratedSeasons.length ? (
            hydratedSeasons.map((season) => (
              <Card key={season.id}>
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-lg font-semibold text-ink">{season.title}</p>
                    <p className="text-sm text-slate-300">{season.year || "Ano n/d"} · {season.episodeCount} episodios</p>
                  </div>
                  <Badge>Temporada {season.number}</Badge>
                </div>
                <div className="mt-4 space-y-3">
                  {season.episodes.length ? (
                    season.episodes.slice(0, 3).map((episode) => (
                      <EpisodeRow key={episode.id} episode={episode} seasonNumber={season.number} authenticated={Boolean(user)} />
                    ))
                  ) : (
                    <EmptyState title="Episodios nao importados" copy="Temporada existe, mas episodios ainda nao foram sincronizados." />
                  )}
                </div>
              </Card>
            ))
          ) : (
            <EmptyState title="Temporadas indisponiveis" copy="Serie importada sem temporadas locais ainda." />
          )}
        </div>
      </section>

      <section>
        <Card>
          <h2 className="text-xl font-semibold text-ink">Proximo episodio</h2>
          {nextEpisode ? (
            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-semibold text-ink">
                  {formatEpisodeCode(nextEpisode.seasonNumber, nextEpisode.number)} · {nextEpisode.title}
                </p>
                <p className="mt-1 text-sm text-slate-300">{formatShortDate(nextEpisode.airedAt)}</p>
                <p className="mt-1 text-xs text-slate-400">
                  {nextEpisode.daysRemaining <= 0 ? "Lanca hoje" : `Faltam ${nextEpisode.daysRemaining} dia(s)`}
                </p>
              </div>
              <Link
                href={`/series/${series.slug}`}
                className="inline-flex min-h-11 items-center justify-center rounded-full bg-ember px-4 text-sm font-semibold text-night"
              >
                Abrir serie
              </Link>
            </div>
          ) : (
            <p className="mt-3 text-sm text-slate-300">Serie sem episodios futuros.</p>
          )}
        </Card>
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
          <h2 className="text-xl font-semibold text-ink">Reviews</h2>
          {reviews.length ? (
            reviews.map((review) => (
              <Card key={review.id}>
                <div className="flex items-center justify-between gap-2">
                  <Link href={`/profile/${review.user.username}`} className="font-semibold text-ink">
                    @{review.user.username}
                  </Link>
                  <Badge>{review.rating}/5</Badge>
                </div>
                <p className="mt-2 text-sm text-slate-300">{review.body}</p>
                {user && review.userId === user.id && review.visibility !== "PUBLIC" ? (
                  <Badge className="mt-2">Somente voce</Badge>
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

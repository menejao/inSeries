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
import { BackdropImage, PosterImage } from "@/components/media/poster-image";
import { Carousel, CarouselItem } from "@/components/media/carousel";
import { SeriesPosterCard } from "@/components/media/series-poster-card";
import { SeriesLogoOrTitle } from "@/components/media/series-logo";
import { CollectionTagList } from "@/components/media/collection-tag-badge";
import { ProviderList } from "@/components/media/provider-badge";
import { CalendarIcon, FilmIcon, ListIcon, SparklesIcon, StarIcon } from "@/components/ui/icons";
import { getCurrentUser } from "@/lib/auth/server";
import { getCatalogSeriesBySlug } from "@/lib/catalog/repository";
import { getStatusBadgeVariant, getStatusLabel } from "@/lib/catalog/status-labels";
import { prisma } from "@/lib/db/prisma";
import { canUseDatabase } from "@/lib/db/health";
import { calculateSeriesProgress } from "@/lib/progress/calculate";
import { getOwnReview, getSeriesReviews } from "@/lib/social/reviews";
import { getPublicListsContainingSeries } from "@/lib/social/lists";
import { getNextEpisodeForSeries } from "@/lib/calendar/queries";
import { searchSeries } from "@/lib/discovery/search";
import { formatShortDate } from "@/lib/calendar/dates";
import { formatEpisodeCode, formatDate, getInitials } from "@/lib/utils";

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
  const listsWithSeries = dbAvailable ? await getPublicListsContainingSeries(series.id) : [];
  const similar = dbAvailable && series.genres[0]
    ? await searchSeries({ genre: series.genres[0], sort: "popular", pageSize: 12 })
    : { items: [] };
  const similarSeries = similar.items.filter((item) => item.id !== series.id).slice(0, 10);

  const hydratedSeasons = series.seasons.map((season) => ({
    ...season,
    episodes: season.episodes.map((episode) => ({
      ...episode,
      watched: watchedMap.has(episode.id)
    }))
  }));

  const totalEpisodes = hydratedSeasons.reduce((sum, item) => sum + item.episodeCount, 0);
  const hasProductionDetails = Boolean(
    series.createdBy.length ||
      series.networks.length ||
      series.productionCompanies.length ||
      series.spokenLanguages.length ||
      series.keywords.length ||
      series.homepage
  );

  return (
    <div className="space-y-6">
      <section className="relative -mx-4 overflow-hidden sm:mx-0 sm:rounded-4xl sm:border sm:border-border">
        <div className="relative aspect-[3/4] sm:aspect-[16/8] lg:aspect-[16/6]">
          <BackdropImage src={series.backdropUrl || series.posterUrl} alt={series.title} priority sizes="100vw" />
          <div className="absolute inset-0 bg-gradient-to-t from-canvas via-canvas/70 sm:via-canvas/50 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-r from-canvas/60 via-transparent to-transparent hidden sm:block" />
        </div>
        <div className="relative -mt-24 flex flex-col gap-6 px-4 pb-6 sm:-mt-32 sm:flex-row sm:items-end sm:px-8 sm:pb-8">
          <div className="hidden w-40 shrink-0 overflow-hidden rounded-3xl border-2 border-border-strong shadow-raised sm:block lg:w-48">
            <div className="relative aspect-[2/3]">
              <PosterImage src={series.posterUrl} alt={series.title} sizes="192px" priority />
            </div>
          </div>
          <div className="min-w-0 flex-1 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={getStatusBadgeVariant(series.status)}>{getStatusLabel(series.status)}</Badge>
              {typeof series.voteAverage === "number" ? (
                <Badge variant="warning">
                  <StarIcon className="h-3 w-3 fill-current" /> {series.voteAverage.toFixed(1)}
                </Badge>
              ) : null}
              {typeof series.qualityScore === "number" ? (
                <Badge variant="primary">
                  <SparklesIcon className="h-3 w-3" /> Quality {Math.round(series.qualityScore)}
                </Badge>
              ) : null}
            </div>
            <SeriesLogoOrTitle
              title={series.title}
              logoUrl={series.logoUrl}
              as="h1"
              textClassName="max-w-3xl text-3xl font-black leading-tight text-ink sm:text-4xl lg:text-5xl"
              logoClassName="h-16 max-w-[280px] sm:h-20"
            />
            {series.originalTitle && series.originalTitle !== series.title ? (
              <p className="text-sm text-muted">{series.originalTitle}</p>
            ) : null}
            <p className="max-w-3xl text-sm leading-7 text-ink/90 line-clamp-3 sm:line-clamp-none">{series.overview}</p>
            <div className="flex flex-wrap gap-2 text-xs text-muted">
              {series.genres.map((genre) => (
                <span key={genre} className="rounded-full bg-surface-strong/80 px-2.5 py-1">
                  {genre}
                </span>
              ))}
            </div>
            <CollectionTagList tags={series.collectionTags} />
            <ProviderList providers={series.watchProviders} />
            <div className="pt-1">
              <SeriesStatusActions seriesId={series.id} initialState={status?.state ?? null} authenticated={Boolean(user)} />
            </div>
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
              <InfoRow label="Tipo" value={series.type || "Nao informado"} />
              <InfoRow label="Pais de origem" value={series.originCountry.length ? series.originCountry.join(", ") : "Nao informado"} />
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

          {hasProductionDetails ? (
            <Card className="space-y-3">
              <h2 className="text-lg font-semibold text-ink">Producao</h2>
              <dl className="space-y-3 text-sm">
                {series.createdBy.length ? <InfoRow label="Criadores" value={series.createdBy.join(", ")} /> : null}
                {series.networks.length ? <InfoRow label="Networks" value={series.networks.join(", ")} /> : null}
                {series.productionCompanies.length ? (
                  <InfoRow label="Produtoras" value={series.productionCompanies.join(", ")} />
                ) : null}
                {series.spokenLanguages.length ? (
                  <InfoRow label="Idiomas falados" value={series.spokenLanguages.join(", ")} />
                ) : null}
              </dl>
              {series.keywords.length ? (
                <div className="flex flex-wrap gap-1.5 border-t border-border pt-3">
                  {series.keywords.slice(0, 8).map((keyword) => (
                    <Link key={keyword} href={`/series?keyword=${encodeURIComponent(keyword)}`}>
                      <Badge variant="outline">{keyword}</Badge>
                    </Link>
                  ))}
                </div>
              ) : null}
              {series.homepage ? (
                <a href={series.homepage} target="_blank" rel="noreferrer" className="link-accent block text-sm">
                  Site oficial
                </a>
              ) : null}
            </Card>
          ) : null}
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

      {listsWithSeries.length ? (
        <section className="space-y-3">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-ink">
            <ListIcon className="h-5 w-5 text-subtle" />
            Aparece nestas listas
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {listsWithSeries.map((list) => (
              <Link key={list.id} href={`/lists/${list.id}`}>
                <Card interactive padding="sm" className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <p className="line-clamp-1 font-semibold text-ink">{list.title}</p>
                    <Badge variant="outline">{list._count.items}</Badge>
                  </div>
                  <p className="text-xs text-subtle">
                    por <span className="font-semibold text-ink">@{list.user.username}</span> · {formatDate(list.createdAt)}
                  </p>
                </Card>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {similarSeries.length ? (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-ink">Series semelhantes</h2>
          <Carousel>
            {similarSeries.map((item) => (
              <CarouselItem key={item.id}>
                <SeriesPosterCard series={item} />
              </CarouselItem>
            ))}
          </Carousel>
        </section>
      ) : null}
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

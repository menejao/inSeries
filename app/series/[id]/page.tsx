import Link from "next/link";
import { notFound } from "next/navigation";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { BackdropImage, PosterImage } from "@/components/media/poster-image";
import { SeriesLogoOrTitle } from "@/components/media/series-logo";
import { SeriesStatusActions } from "@/components/series/series-status-actions";
import { SeriesMoreActions } from "@/components/series/series-more-actions";
import { SeriesInfoBlock } from "@/components/series/series-info-block";
import { SeriesColumnsLayout } from "@/components/series/series-columns-layout";
import { SeriesContinueWatching } from "@/components/series/series-continue-watching";
import { SeasonSelector } from "@/components/series/season-selector";
import { ReviewsSection } from "@/components/series/reviews-section";
import { SeriesRecommendationsSection } from "@/components/series/series-recommendations";
import { CastCarousel } from "@/components/series/cast-carousel";
import { SeriesGallery } from "@/components/series/series-gallery";
import { SeriesTrailers } from "@/components/series/series-trailers";
import { SeriesTimeline } from "@/components/series/series-timeline";
import { AddToListButton } from "@/components/series/add-to-list-button";
import { SeriesFavoriteButton } from "@/components/series/series-favorite-button";
import { ReviewForm } from "@/components/reviews/review-form";
import { FixedGrid } from "@/components/ui/fixed-grid";
import { CalendarIcon, ListIcon, StarIcon } from "@/components/ui/icons";
import { buttonVariants } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth/server";
import { getCatalogSeriesSummaryBySlug, getSeasonEpisodes } from "@/lib/catalog/repository";
import { getStatusBadgeVariant, getStatusLabel } from "@/lib/catalog/status-labels";
import { prisma } from "@/lib/db/prisma";
import { canUseDatabase } from "@/lib/db/health";
import { getSeriesProgressSummary } from "@/lib/progress/series-summary";
import { getOwnReview, getSeriesReviews } from "@/lib/social/reviews";
import { getPublicListsContainingSeries } from "@/lib/social/lists";
import { getNextEpisodeForSeries } from "@/lib/calendar/queries";
import { getWatchNextForUser } from "@/lib/watch-next";
import { getSeriesAddedToListAt, getUserListsForSeries, getSeriesMedia } from "@/lib/series-page/queries";
import { getSeriesRecommendations } from "@/lib/series-page/recommendations";
import { computeSeriesTimeline } from "@/lib/series-page/timeline";
import { formatShortDate } from "@/lib/calendar/dates";
import { formatEpisodeCode, formatDate } from "@/lib/utils";
import { SeriesJourneySection } from "@/components/series/series-journey-section";

/**
 * INSERIES-SERIES-PAGE-PREMIUM-01 — the series detail page as the app's richest, most
 * central screen: discover, resume, track progress, manage lists, review and find related
 * content, all in one place. Every section reuses an existing service (Watch Next,
 * recommendations engine, Smart Lists, catalog search) — nothing here recomputes an
 * algorithm that already lives elsewhere. See README for the full Fase 1 audit and
 * per-section decisions.
 */
export default async function SeriesDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const series = await getCatalogSeriesSummaryBySlug(id);

  if (!series) notFound();

  const user = await getCurrentUser();
  const dbAvailable = await canUseDatabase();
  const firstSeason = series.seasons[0] ?? null;

  const [statusRow, progressSummary, initialSeasonEpisodesRaw, reviews, ownReview, nextEpisode, listsWithSeries, watchNextResult, addedToListAt, userLists, recommendations, media] =
    await Promise.all([
      user && dbAvailable
        ? prisma.userSeriesStatus.findUnique({ where: { userId_seriesId: { userId: user.id, seriesId: series.id } } })
        : Promise.resolve(null),
      // Fase 25 (INSERIES-CATALOG-SERIES-EXPERIENCE-01) — bounded by watched count, not by
      // the catalog's total episode count (ver lib/progress/series-summary.ts).
      user && dbAvailable
        ? getSeriesProgressSummary(
            user.id,
            series.id,
            series.seasons.map((season) => ({ number: season.number, episodeCount: season.episodeCount }))
          )
        : Promise.resolve(null),
      // Only the first season's episodes are fetched server-side (for the initial render);
      // every other season is fetched client-side, on demand, by SeasonSelector.
      firstSeason ? getSeasonEpisodes(series.id, firstSeason.number) : Promise.resolve([]),
      dbAvailable ? getSeriesReviews(series.id, user?.id) : Promise.resolve([]),
      user && dbAvailable ? getOwnReview(user.id, series.id) : Promise.resolve(null),
      dbAvailable ? getNextEpisodeForSeries(series.id) : Promise.resolve(null),
      dbAvailable ? getPublicListsContainingSeries(series.id) : Promise.resolve([]),
      user && dbAvailable ? getWatchNextForUser(user.id) : Promise.resolve(null),
      user && dbAvailable ? getSeriesAddedToListAt(user.id, series.id) : Promise.resolve(null),
      user && dbAvailable ? getUserListsForSeries(user.id, series.id) : Promise.resolve([]),
      dbAvailable ? getSeriesRecommendations(series, user?.id) : Promise.resolve({ youMayLike: [], officialUniverse: [] }),
      dbAvailable ? getSeriesMedia(series.id) : Promise.resolve({ cast: [], videos: [], backdropUrls: [], posterUrls: [] })
    ]);

  let initialSeasonEpisodes = initialSeasonEpisodesRaw;
  if (user && dbAvailable && initialSeasonEpisodesRaw.length) {
    const watchedRows = await prisma.userEpisodeProgress.findMany({
      where: { userId: user.id, episodeId: { in: initialSeasonEpisodesRaw.map((episode) => episode.id) }, watched: true },
      select: { episodeId: true, watchedAt: true }
    });
    const watchedMap = new Map(watchedRows.map((row) => [row.episodeId, row.watchedAt]));
    initialSeasonEpisodes = initialSeasonEpisodesRaw.map((episode) => ({
      ...episode,
      watched: watchedMap.has(episode.id),
      watchedAt: watchedMap.get(episode.id)?.toISOString() ?? null
    }));
  }

  // "Sua jornada com esta serie" — ultimas atividades do usuario ligadas a esta serie
  // especifica (episodios assistidos, mudancas de status, conclusao, reviews).
  const JOURNEY_LIMIT = 10;
  const journeyItems = user && dbAvailable
    ? await prisma.activity.findMany({
        where: {
          userId: user.id,
          seriesId: series.id,
          type: { in: ["EPISODE_WATCHED", "SERIES_STATUS_CHANGED", "SERIES_COMPLETED", "REVIEW_CREATED"] }
        },
        select: {
          id: true,
          type: true,
          createdAt: true,
          metadata: true,
          episode: { select: { number: true, title: true, season: { select: { number: true } } } },
          review: { select: { rating: true } }
        },
        orderBy: { createdAt: "desc" },
        take: JOURNEY_LIMIT + 1
      })
    : [];
  const journeyHasMore = journeyItems.length > JOURNEY_LIMIT;
  const journeyPage = journeyHasMore ? journeyItems.slice(0, JOURNEY_LIMIT) : journeyItems;
  const initialJourney = {
    items: journeyPage.map((item) => ({ ...item, createdAt: item.createdAt.toISOString() })),
    nextCursor: journeyHasMore ? journeyPage[journeyPage.length - 1].createdAt.toISOString() : null
  };

  const totalEpisodes = series.numberOfEpisodes ?? series.seasons.reduce((sum, item) => sum + item.episodeCount, 0);
  const progress = progressSummary
    ? { percentage: progressSummary.percentage, watchedEpisodes: progressSummary.watchedEpisodes }
    : null;

  const timelineEvents = user
    ? computeSeriesTimeline({
        startedAt: statusRow?.startedAt ?? null,
        lastWatchedEpisode: progressSummary?.lastWatchedEpisode ?? null,
        completedSeasons: (progressSummary?.completedSeasonNumbers ?? []).map((number) => ({ number, completedAt: progressSummary?.lastWatchedEpisode?.watchedAt ?? new Date() })),
        reviewedAt: ownReview?.updatedAt ?? null,
        addedToListAt
      })
    : [];

  const watchNextItemForSeries = watchNextResult?.items.find((item) => item.series.id === series.id) ?? null;

  return (
    <div className="space-y-8">
      {/*
        Fase 10/11/12 (INSERIES-CATALOG-SERIES-EXPERIENCE-V2) — Hero reduzido: aspect-ratio
        mais baixa (era 16/6 no desktop, agora 21/9) e offset de sobreposicao menor (-mt-32 ->
        -mt-14), poster menor, no maximo 2 badges (Status + Nota) no topo — Quality/Discovery
        Score viraram um dado do bloco de informacoes (Fase 25), nao um badge competindo por
        atencao no Hero. Overlay de gradiente reforcado (via-canvas/80) garante contraste do
        texto mesmo sobre um backdrop claro (Fase 12).
      */}
      <section className="relative -mx-4 overflow-hidden sm:mx-0 sm:rounded-4xl sm:border sm:border-border">
        <div className="relative aspect-[4/3] sm:aspect-[21/9] lg:aspect-[21/7]">
          <BackdropImage src={series.backdropUrl || series.posterUrl} alt={series.title} priority sizes="100vw" />
          <div className="absolute inset-0 bg-gradient-to-t from-canvas via-canvas/80 sm:via-canvas/60 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-r from-canvas/70 via-transparent to-transparent hidden sm:block" />
        </div>
        <div className="relative -mt-14 flex flex-col gap-4 px-4 pb-5 sm:-mt-16 sm:flex-row sm:items-end sm:px-8 sm:pb-6">
          <div className="hidden w-28 shrink-0 overflow-hidden rounded-2xl border-2 border-border-strong shadow-raised sm:block lg:w-32">
            <div className="relative aspect-[2/3]">
              <PosterImage src={series.posterUrl} alt={series.title} sizes="128px" priority />
            </div>
          </div>
          <div className="min-w-0 flex-1 space-y-2.5">
            {/* Informacoes principais: status + nota, titulo, ano/temporadas/episodios */}
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={getStatusBadgeVariant(series.status)}>{getStatusLabel(series.status)}</Badge>
              {typeof series.voteAverage === "number" ? (
                <Badge variant="warning">
                  <StarIcon className="h-3 w-3 fill-current" /> {series.voteAverage.toFixed(1)}
                </Badge>
              ) : null}
            </div>
            <SeriesLogoOrTitle
              title={series.title}
              logoUrl={series.logoUrl}
              as="h1"
              textClassName="max-w-3xl text-2xl font-black leading-tight text-ink sm:text-3xl lg:text-4xl"
              logoClassName="h-12 max-w-[240px] sm:h-16"
            />
            <p className="text-xs text-muted">
              {series.year || "Ano n/d"} · {series.numberOfSeasons ?? series.seasons.length} temporada
              {(series.numberOfSeasons ?? series.seasons.length) === 1 ? "" : "s"} ·{" "}
              {series.numberOfEpisodes ?? totalEpisodes} episodios
            </p>

            {/* Sinopse */}
            <p className="max-w-3xl text-sm leading-6 text-ink/90 line-clamp-2">{series.overview}</p>

            {/* Acoes: Acompanhar / Lista / Avaliar / Mais acoes */}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <SeriesStatusActions seriesId={series.id} initialState={statusRow?.state ?? null} authenticated={Boolean(user)} />
              <SeriesFavoriteButton seriesId={series.id} initialFavorite={statusRow?.isFavorite ?? false} authenticated={Boolean(user)} />
              <AddToListButton seriesId={series.id} lists={userLists} authenticated={Boolean(user)} />
              <Link href="#reviews" className={buttonVariants({ variant: "secondary", size: "md" })}>
                <StarIcon className="h-4 w-4" />
                Avaliar
              </Link>
              <SeriesMoreActions title={series.title} />
            </div>

            {/* Informacoes secundarias: generos, criadores — menores, discretas */}
            {series.genres.length || series.createdBy.length ? (
              <p className="text-xs text-subtle">
                {series.genres.slice(0, 3).join(", ")}
                {series.genres.length && series.createdBy.length ? " · " : ""}
                {series.createdBy.length ? `Criado por ${series.createdBy.slice(0, 2).join(", ")}` : ""}
              </p>
            ) : null}
          </div>
        </div>
      </section>

      {/* Fase 14/18 — acompanhamento continua sendo a informacao mais importante, destacado logo abaixo do Hero. */}
      {watchNextItemForSeries ? (
        <SeriesContinueWatching
          item={watchNextItemForSeries}
          seriesProgressPercent={progress?.percentage ?? 0}
          lastWatchedLabel={progressSummary?.lastWatchedEpisode ? formatShortDate(progressSummary.lastWatchedEpisode.watchedAt) : null}
        />
      ) : null}

      <SeriesColumnsLayout
        left={
          <>
            <SeriesInfoBlock
              series={series}
              totalEpisodes={totalEpisodes}
              progressPercent={progress?.percentage ?? 0}
              watchedEpisodes={progress?.watchedEpisodes ?? 0}
              authenticated={Boolean(user)}
            />

            {user && initialJourney.items.length > 0 ? (
              <Card className="space-y-3">
                <h2 className="text-lg font-semibold text-ink">Sua jornada com esta serie</h2>
                <SeriesJourneySection seriesId={series.id} initialData={initialJourney} />
              </Card>
            ) : null}

            {nextEpisode ? (
              <Card className="space-y-3">
                <h2 className="flex items-center gap-2 text-lg font-semibold text-ink">
                  <CalendarIcon className="h-5 w-5 text-subtle" />
                  Proximo lancamento
                </h2>
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
              </Card>
            ) : null}

            {user ? <SeriesTimeline events={timelineEvents} /> : null}
          </>
        }
        right={
          <>
            <h2 className="shrink-0 text-lg font-semibold text-ink">Temporadas</h2>
            {series.seasons.length && firstSeason ? (
              <SeasonSelector
                seriesId={series.id}
                seasons={series.seasons}
                initialSeasonNumber={firstSeason.number}
                initialEpisodes={initialSeasonEpisodes}
                authenticated={Boolean(user)}
              />
            ) : (
              <EmptyState title="Temporadas indisponiveis" copy="Serie importada sem temporadas locais ainda." />
            )}
          </>
        }
      />

      <CastCarousel cast={media.cast} />
      <SeriesGallery backdropUrls={media.backdropUrls} posterUrls={media.posterUrls} />
      <SeriesTrailers videos={media.videos} />

      <section className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
        <ReviewForm
          seriesId={series.id}
          authenticated={Boolean(user)}
          initialReview={
            ownReview
              ? { rating: ownReview.rating, body: ownReview.body, visibility: ownReview.visibility, containsSpoiler: ownReview.containsSpoiler }
              : null
          }
        />
        <ReviewsSection
          reviews={reviews}
          viewerId={user?.id}
          authenticated={Boolean(user)}
          seriesQualityScore={series.qualityScore}
          seriesDiscoveryScore={series.discoveryScore}
          seriesCollectionTags={series.collectionTags}
        />
      </section>

      {listsWithSeries.length ? (
        <section className="space-y-3">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-ink">
            <ListIcon className="h-5 w-5 text-subtle" />
            Aparece nestas listas
          </h2>
          <FixedGrid mobile={1} tablet={2} desktop={3}>
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
          </FixedGrid>
        </section>
      ) : null}

      <SeriesRecommendationsSection recommendations={recommendations} />
    </div>
  );
}

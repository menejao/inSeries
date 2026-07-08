import Link from "next/link";
import { notFound } from "next/navigation";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { BackdropImage, PosterImage } from "@/components/media/poster-image";
import { SeriesLogoOrTitle } from "@/components/media/series-logo";
import { CollectionTagList } from "@/components/media/collection-tag-badge";
import { ProviderList } from "@/components/media/provider-badge";
import { SeriesStatusActions } from "@/components/series/series-status-actions";
import { SeriesContinueWatching } from "@/components/series/series-continue-watching";
import { SeasonCard } from "@/components/series/season-card";
import { ProductionSection } from "@/components/series/production-section";
import { WhereToWatchCard } from "@/components/series/where-to-watch-card";
import { ReviewsSection } from "@/components/series/reviews-section";
import { SeriesRecommendationsSection } from "@/components/series/series-recommendations";
import { SeriesTimeline } from "@/components/series/series-timeline";
import { AddToListButton } from "@/components/series/add-to-list-button";
import { ShareButton } from "@/components/series/share-button";
import { ReviewForm } from "@/components/reviews/review-form";
import { FixedGrid } from "@/components/ui/fixed-grid";
import { CalendarIcon, FlameIcon, ListIcon, PlayIcon, SparklesIcon, StarIcon } from "@/components/ui/icons";
import { buttonVariants } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth/server";
import { getCatalogSeriesBySlug } from "@/lib/catalog/repository";
import { getStatusBadgeVariant, getStatusLabel } from "@/lib/catalog/status-labels";
import { prisma } from "@/lib/db/prisma";
import { canUseDatabase } from "@/lib/db/health";
import { computeSeriesProgressFromEpisodes } from "@/lib/progress/calculate";
import { getOwnReview, getSeriesReviews } from "@/lib/social/reviews";
import { getPublicListsContainingSeries } from "@/lib/social/lists";
import { getNextEpisodeForSeries } from "@/lib/calendar/queries";
import { getWatchNextForUser } from "@/lib/watch-next";
import { getSeriesAddedToListAt, getUserListsForSeries } from "@/lib/series-page/queries";
import { getSeriesRecommendations } from "@/lib/series-page/recommendations";
import { computeSeriesTimeline } from "@/lib/series-page/timeline";
import { formatShortDate } from "@/lib/calendar/dates";
import { formatEpisodeCode, formatDate } from "@/lib/utils";

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
  const series = await getCatalogSeriesBySlug(id);

  if (!series) notFound();

  const user = await getCurrentUser();
  const dbAvailable = await canUseDatabase();
  const allEpisodeIds = series.seasons.flatMap((season) => season.episodes.map((episode) => episode.id));

  const [statusRow, watchedRows, reviews, ownReview, nextEpisode, listsWithSeries, watchNextResult, addedToListAt, userLists, recommendations] =
    await Promise.all([
      user && dbAvailable
        ? prisma.userSeriesStatus.findUnique({ where: { userId_seriesId: { userId: user.id, seriesId: series.id } } })
        : Promise.resolve(null),
      user && dbAvailable
        ? prisma.userEpisodeProgress.findMany({
            where: { userId: user.id, episodeId: { in: allEpisodeIds }, watched: true },
            select: { episodeId: true, watchedAt: true }
          })
        : Promise.resolve([]),
      dbAvailable ? getSeriesReviews(series.id, user?.id) : Promise.resolve([]),
      user && dbAvailable ? getOwnReview(user.id, series.id) : Promise.resolve(null),
      dbAvailable ? getNextEpisodeForSeries(series.id) : Promise.resolve(null),
      dbAvailable ? getPublicListsContainingSeries(series.id) : Promise.resolve([]),
      user && dbAvailable ? getWatchNextForUser(user.id) : Promise.resolve(null),
      user && dbAvailable ? getSeriesAddedToListAt(user.id, series.id) : Promise.resolve(null),
      user && dbAvailable ? getUserListsForSeries(user.id, series.id) : Promise.resolve([]),
      dbAvailable ? getSeriesRecommendations(series, user?.id) : Promise.resolve({ similar: [], sameCategory: [], marathons: [], personalized: null })
    ]);

  // Fase 12 — watchedMap keeps timestamps (not just membership) so this page can derive
  // progress/last-watched-episode/completed-seasons locally instead of re-fetching the
  // same series+progress rows a second time via calculateSeriesProgress.
  const watchedMap = new Map(watchedRows.filter((row) => row.watchedAt).map((row) => [row.episodeId, row.watchedAt as Date]));

  const hydratedSeasons = series.seasons.map((season) => ({
    ...season,
    episodes: season.episodes.map((episode) => ({ ...episode, watched: watchedMap.has(episode.id) }))
  }));

  const allEpisodesFlat = hydratedSeasons.flatMap((season) => season.episodes.map((episode) => ({ ...episode, seasonNumber: season.number })));
  const totalEpisodes = hydratedSeasons.reduce((sum, item) => sum + item.episodeCount, 0);
  const progress = user ? computeSeriesProgressFromEpisodes(allEpisodesFlat, new Set(watchedMap.keys())) : null;

  const lastWatchedEntry = [...watchedMap.entries()].sort((a, b) => b[1].getTime() - a[1].getTime())[0];
  const lastWatchedEpisode = lastWatchedEntry
    ? (() => {
        const episode = allEpisodesFlat.find((item) => item.id === lastWatchedEntry[0]);
        return episode ? { seasonNumber: episode.seasonNumber, number: episode.number, title: episode.title, watchedAt: lastWatchedEntry[1] } : null;
      })()
    : null;

  const completedSeasons = hydratedSeasons
    .filter((season) => season.episodeCount > 0 && season.episodes.length > 0 && season.episodes.every((episode) => episode.watched))
    .map((season) => ({
      number: season.number,
      completedAt: new Date(Math.max(...season.episodes.map((episode) => watchedMap.get(episode.id)?.getTime() ?? 0)))
    }));

  const timelineEvents = user
    ? computeSeriesTimeline({
        startedAt: statusRow?.startedAt ?? null,
        lastWatchedEpisode,
        completedSeasons,
        reviewedAt: ownReview?.updatedAt ?? null,
        addedToListAt
      })
    : [];

  const watchNextItemForSeries = watchNextResult?.items.find((item) => item.series.id === series.id) ?? null;

  return (
    <div className="space-y-8">
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
              {typeof series.discoveryScore === "number" ? (
                <Badge variant="secondary">
                  <FlameIcon className="h-3 w-3" /> Discovery {Math.round(series.discoveryScore)}
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
            {series.tagline ? <p className="max-w-2xl text-sm italic text-ink/80">&ldquo;{series.tagline}&rdquo;</p> : null}
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
            <ProviderList providers={series.watchProviders} limit={5} />
            <div className="flex flex-wrap items-center gap-2 pt-1">
              {watchNextItemForSeries ? (
                <Link href="#continuar-assistindo" className={buttonVariants({ variant: "primary", size: "md" })}>
                  <PlayIcon className="h-4 w-4" />
                  Continuar assistindo
                </Link>
              ) : null}
              <AddToListButton seriesId={series.id} lists={userLists} authenticated={Boolean(user)} />
              <Link href="#reviews" className={buttonVariants({ variant: "secondary", size: "md" })}>
                <StarIcon className="h-4 w-4" />
                Avaliar
              </Link>
              <ShareButton title={series.title} />
            </div>
            <div className="pt-1">
              <SeriesStatusActions seriesId={series.id} initialState={statusRow?.state ?? null} authenticated={Boolean(user)} />
            </div>
          </div>
        </div>
      </section>

      {watchNextItemForSeries ? (
        <SeriesContinueWatching
          item={watchNextItemForSeries}
          seriesSlug={series.slug}
          seriesProgressPercent={progress?.percentage ?? 0}
          lastWatchedLabel={lastWatchedEpisode ? formatShortDate(lastWatchedEpisode.watchedAt) : null}
        />
      ) : null}

      <section className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
        <div className="space-y-6">
          <Card className="space-y-4">
            <h2 className="text-lg font-semibold text-ink">Resumo</h2>
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <InfoRow label="Idioma" value={series.language || "Nao informado"} />
              <InfoRow label="Plataforma" value={series.platform || "Nao informado"} />
              <InfoRow label="Temporadas" value={String(series.numberOfSeasons ?? hydratedSeasons.length)} />
              <InfoRow label="Episodios" value={String(series.numberOfEpisodes ?? totalEpisodes)} />
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
              Proximo lancamento
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

          <WhereToWatchCard providers={series.watchProviders} />

          <ProductionSection series={series} />

          {user ? <SeriesTimeline events={timelineEvents} /> : null}
        </div>

        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-ink">Temporadas</h2>
          {hydratedSeasons.length ? (
            <div className="space-y-4">
              {hydratedSeasons.map((season, index) => (
                <SeasonCard key={season.id} season={season} authenticated={Boolean(user)} defaultExpanded={index === 0} />
              ))}
            </div>
          ) : (
            <EmptyState title="Temporadas indisponiveis" copy="Serie importada sem temporadas locais ainda." />
          )}
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
        <ReviewForm
          seriesId={series.id}
          authenticated={Boolean(user)}
          initialReview={ownReview ? { rating: ownReview.rating, body: ownReview.body, visibility: ownReview.visibility } : null}
        />
        <ReviewsSection reviews={reviews} viewerId={user?.id} />
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

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-subtle">{label}</dt>
      <dd className="mt-0.5 font-medium text-ink">{value}</dd>
    </div>
  );
}

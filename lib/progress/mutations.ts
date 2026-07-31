import { prisma } from "@/lib/db/prisma";
import { calculateSeriesProgress } from "@/lib/progress/calculate";
import { isEpisodeAvailable } from "@/lib/progress/availability";
import { resolveStateAfterEpisodeChange } from "@/lib/progress/status-resolver";
import { recordActivity } from "@/lib/social/activity";
import { notifySeriesCompleted } from "@/lib/notifications/events";
import { invalidateRecommendationCache } from "@/lib/recommendations";
import { invalidateStatsCache } from "@/lib/stats";
import { invalidateWrappedCache } from "@/lib/recap/wrapped-cache";
import { recordGamificationEvent } from "@/lib/gamification";
import type { WatchState } from "@/lib/types";

/**
 * INSERIES-SERIES-STATUS-ENGINE-01 — applies a freshly computed progress result to
 * `UserSeriesStatus`, deciding `completedAt`/`lastActivityAt` consistently for every caller
 * (manual status change, single episode toggle, bulk season/series completion). Never called
 * directly by API routes — always through one of the mutations below, so there is exactly one
 * place that writes this row.
 */
async function writeSeriesStatus(
  userId: string,
  seriesId: string,
  state: WatchState,
  progress: { percentage: number; completed: boolean },
  options: { touchLastActivity: boolean; touchLastWatched?: boolean; trackingStart?: Date | null; completedAtOverride?: Date }
) {
  const now = new Date();
  const data = {
    state,
    completionPercent: progress.percentage,
    completedAt: state === "COMPLETED" ? (options.completedAtOverride ?? now) : null,
    ...(options.touchLastActivity ? { lastActivityAt: now } : {}),
    ...(options.touchLastWatched ? { lastWatchedAt: now } : {})
  };

  return prisma.userSeriesStatus.upsert({
    where: { userId_seriesId: { userId, seriesId } },
    update: data,
    create: { userId, seriesId, lastActivityAt: now, startedAt: options.trackingStart ?? null, ...data }
  });
}

/**
 * INSERIES-SERIES-STATUS-ENGINE-01 — "selecionar Concluida": marca automaticamente todos os
 * episodios DISPONIVEIS (nunca futuros) como assistidos, recalcula tudo e registra a data da
 * conclusao. The one place that bulk-marks a whole series watched — reused by `upsertSeriesStatus`
 * (manual "Concluida" selection) and available for the catalog quick-actions menu.
 */
async function markAllAvailableEpisodesWatched(userId: string, seriesId: string, watchedAt: Date = new Date()) {
  const series = await prisma.series.findUnique({
    where: { id: seriesId },
    include: { seasons: { include: { episodes: { select: { id: true, airedAt: true } } } } }
  });
  if (!series) return;

  const availableEpisodeIds = series.seasons
    .flatMap((season) => season.episodes)
    .filter((episode) => isEpisodeAvailable(episode.airedAt))
    .map((episode) => episode.id);

  if (!availableEpisodeIds.length) return;

  await prisma.$transaction(
    availableEpisodeIds.map((episodeId) =>
      prisma.userEpisodeProgress.upsert({
        where: { userId_episodeId: { userId, episodeId } },
        update: { watched: true, watchedAt },
        create: { userId, episodeId, watched: true, watchedAt }
      })
    )
  );
}

/**
 * `completedAt` (INSERIES-SERIES-LIBRARY-ENGINE-01) — "Quando voce terminou esta serie? Hoje /
 * Escolher uma data": applied to every auto-marked episode's `watchedAt` and to the status
 * row's own `completedAt`, only when `state === "COMPLETED"`. Ignored for every other state.
 */
export async function upsertSeriesStatus(userId: string, seriesId: string, state: WatchState, completedAt?: Date) {
  const previous = await prisma.userSeriesStatus.findUnique({
    where: { userId_seriesId: { userId, seriesId } },
    select: { state: true, startedAt: true }
  });

  // INSERIES-SERIES-STATUS-ENGINE-01 — "ao selecionar Concluida... marcar automaticamente
  // todos os episodios disponiveis" vs. "ao selecionar Assistindo... nenhum episodio deve ser
  // alterado automaticamente, apenas o status": COMPLETED is the only manual selection with an
  // episode side-effect.
  if (state === "COMPLETED") {
    await markAllAvailableEpisodesWatched(userId, seriesId, completedAt);
  }

  const progress = (await calculateSeriesProgress(userId, seriesId)) ?? { percentage: 0, completed: false };
  const trackingStart = previous?.startedAt ?? (state !== "WANT_TO_WATCH" ? new Date() : null);
  const status = await writeSeriesStatus(userId, seriesId, state, progress, {
    touchLastActivity: true,
    touchLastWatched: state === "WATCHING" || state === "COMPLETED",
    trackingStart,
    completedAtOverride: state === "COMPLETED" ? completedAt : undefined
  });

  if (!previous || previous.state !== state) {
    if (state === "COMPLETED" && previous?.state !== "COMPLETED") {
      await recordActivity({ userId, type: "SERIES_COMPLETED", seriesId, metadata: { from: previous?.state ?? null } });
      await notifySeriesCompleted(userId, seriesId);
      await recordGamificationEvent({ type: "SERIES_COMPLETED", userId, seriesId });
    } else if (state !== "COMPLETED") {
      await recordActivity({ userId, type: "SERIES_STATUS_CHANGED", seriesId, metadata: { from: previous?.state ?? null, to: state } });
    }
  }

  invalidateRecommendationCache(userId);
  invalidateStatsCache(userId);
  invalidateWrappedCache(userId);

  return status;
}

/**
 * Fase 7 (INSERIES-MY-LISTS-PREMIUM-01) — "Remover" da Minha Lista. Nao havia nenhum jeito
 * de apagar um `UserSeriesStatus` (so criar/atualizar via `upsertSeriesStatus`); esta e a
 * unica peca de CRUD que faltava, nao uma regra de negocio nova. Sem efeito de atividade/
 * gamificacao — remover o status nao e um evento a ser comemorado ou registrado no feed,
 * so a limpeza reversa de um `upsertSeriesStatus` anterior.
 */
export async function removeSeriesStatus(userId: string, seriesId: string) {
  await prisma.$transaction([
    prisma.userEpisodeProgress.deleteMany({ where: { userId, episode: { season: { seriesId } } } }),
    prisma.userSeriesStatus.deleteMany({ where: { userId, seriesId } })
  ]);
  invalidateRecommendationCache(userId);
  invalidateStatsCache(userId);
  invalidateWrappedCache(userId);
}

const NEW_EPISODE_LOOKBACK_HOURS = 48;

/**
 * INSERIES-SERIES-LIBRARY-ENGINE-01 — "quando um novo episodio for lancado, se a serie
 * estiver Concluida... o status muda automaticamente para Assistindo": `completionPercent`
 * so e recalculado dentro das mutations deste arquivo, entao uma serie Concluida cujo
 * catalogo ganhou um episodio novo (airedAt passou a ser <= agora) fica com o status
 * desatualizado ate algo recalcular. Roda no cron diario (mesmo padrao de
 * pauseInactiveSeriesForAllUsers) — restrito a series com episodio lancado nas ultimas
 * `NEW_EPISODE_LOOKBACK_HOURS` horas, pra nao recalcular toda a base COMPLETED a cada run.
 */
export async function promoteCompletedSeriesWithNewEpisodes(): Promise<{ promotedCount: number }> {
  const since = new Date(Date.now() - NEW_EPISODE_LOOKBACK_HOURS * 60 * 60 * 1000);
  const now = new Date();

  const recentlyAired = await prisma.series.findMany({
    where: { seasons: { some: { episodes: { some: { airedAt: { gte: since, lte: now } } } } } },
    select: { id: true }
  });
  if (!recentlyAired.length) return { promotedCount: 0 };

  const candidates = await prisma.userSeriesStatus.findMany({
    where: { state: "COMPLETED", seriesId: { in: recentlyAired.map((series) => series.id) } },
    select: { userId: true, seriesId: true }
  });

  let promotedCount = 0;
  for (const candidate of candidates) {
    const progress = await calculateSeriesProgress(candidate.userId, candidate.seriesId);
    if (!progress || progress.completed) continue;

    await writeSeriesStatus(candidate.userId, candidate.seriesId, "WATCHING", progress, { touchLastActivity: false });

    await recordActivity({
      userId: candidate.userId,
      type: "SERIES_STATUS_CHANGED",
      seriesId: candidate.seriesId,
      visibility: "PRIVATE",
      metadata: { from: "COMPLETED", to: "WATCHING", automatic: true, reason: "new_episode" }
    });

    invalidateRecommendationCache(candidate.userId);
    invalidateStatsCache(candidate.userId);
    invalidateWrappedCache(candidate.userId);
    promotedCount += 1;
  }

  return { promotedCount };
}

/**
 * `watchedAt` (INSERIES-SERIES-LIBRARY-ENGINE-01) — "ao marcar um episodio individualmente,
 * escolher a data que assisti": opcional, so aplicado quando `watched === true`; ignorado ao
 * desmarcar (watchedAt sempre vira null nesse caso). Sem valor, cai no comportamento anterior
 * (agora).
 */
export async function toggleEpisodeProgress(userId: string, episodeId: string, watched: boolean, watchedAt?: Date) {
  const episode = await prisma.episode.findUnique({
    where: { id: episodeId },
    include: { season: { select: { seriesId: true } } }
  });

  if (!episode) {
    return null;
  }

  // "Episodios futuros... nao podem ser marcados automaticamente como assistidos" — applies to
  // manual marking too: an unaired episode simply cannot be checked off.
  if (watched && !isEpisodeAvailable(episode.airedAt)) {
    return { error: "episode_not_available" as const };
  }

  const previousProgress = await prisma.userEpisodeProgress.findUnique({
    where: { userId_episodeId: { userId, episodeId } },
    select: { watched: true }
  });
  const wasWatched = previousProgress?.watched ?? false;
  const resolvedWatchedAt = watched ? (watchedAt ?? new Date()) : null;

  await prisma.userEpisodeProgress.upsert({
    where: { userId_episodeId: { userId, episodeId } },
    update: { watched, watchedAt: resolvedWatchedAt },
    create: { userId, episodeId, watched, watchedAt: resolvedWatchedAt }
  });

  const justWatched = watched && !wasWatched;
  if (justWatched) {
    await recordActivity({ userId, type: "EPISODE_WATCHED", seriesId: episode.season.seriesId, episodeId });
    await recordGamificationEvent({ type: "EPISODE_WATCHED", userId });
  }

  const previousStatus = await prisma.userSeriesStatus.findUnique({
    where: { userId_seriesId: { userId, seriesId: episode.season.seriesId } },
    select: { state: true, startedAt: true }
  });

  const progress = (await calculateSeriesProgress(userId, episode.season.seriesId)) ?? { percentage: 0, completed: false };
  const nextState = resolveStateAfterEpisodeChange(previousStatus?.state ?? null, progress, justWatched);
  const trackingStart = previousStatus?.startedAt ?? (watched ? new Date() : null);

  // "Desmarcar um episodio nao devera atualizar lastWatchedAt como uma nova atividade de
  // visualizacao" — lastActivityAt only moves forward when an episode was actually watched.
  await writeSeriesStatus(userId, episode.season.seriesId, nextState, progress, {
    touchLastActivity: justWatched,
    touchLastWatched: watched,
    trackingStart
  });

  if (progress.completed && previousStatus?.state !== "COMPLETED") {
    await recordActivity({ userId, type: "SERIES_COMPLETED", seriesId: episode.season.seriesId, metadata: { from: previousStatus?.state ?? null } });
    await notifySeriesCompleted(userId, episode.season.seriesId);
    await recordGamificationEvent({ type: "SERIES_COMPLETED", userId, seriesId: episode.season.seriesId });
  }

  invalidateRecommendationCache(userId);
  invalidateStatsCache(userId);
  invalidateWrappedCache(userId);

  return progress;
}

/**
 * INSERIES-SERIES-STATUS-ENGINE-01 — "marcar temporada como assistida": marks every AVAILABLE
 * episode of the season watched in one batch (never future ones), then recalculates the whole
 * series' progress/status once — not one `toggleEpisodeProgress` call per episode (the old
 * `SeasonSelector` behavior), which re-read/re-wrote `UserSeriesStatus` once per episode.
 */
export async function markSeasonWatched(userId: string, seasonId: string) {
  const season = await prisma.season.findUnique({
    where: { id: seasonId },
    include: { episodes: { select: { id: true, airedAt: true } } }
  });
  if (!season) return null;

  const availableEpisodeIds = season.episodes.filter((episode) => isEpisodeAvailable(episode.airedAt)).map((episode) => episode.id);
  if (!availableEpisodeIds.length) return { seriesId: season.seriesId, markedCount: 0 };

  const alreadyWatched = await prisma.userEpisodeProgress.findMany({
    where: { userId, episodeId: { in: availableEpisodeIds }, watched: true },
    select: { episodeId: true }
  });
  const alreadyWatchedIds = new Set(alreadyWatched.map((row) => row.episodeId));
  const toMark = availableEpisodeIds.filter((id) => !alreadyWatchedIds.has(id));

  if (toMark.length) {
    const now = new Date();
    await prisma.$transaction(
      toMark.map((episodeId) =>
        prisma.userEpisodeProgress.upsert({
          where: { userId_episodeId: { userId, episodeId } },
          update: { watched: true, watchedAt: now },
          create: { userId, episodeId, watched: true, watchedAt: now }
        })
      )
    );
    await recordGamificationEvent({ type: "EPISODE_WATCHED", userId });
  }

  const previousStatus = await prisma.userSeriesStatus.findUnique({
    where: { userId_seriesId: { userId, seriesId: season.seriesId } },
    select: { state: true, startedAt: true }
  });

  const progress = (await calculateSeriesProgress(userId, season.seriesId)) ?? { percentage: 0, completed: false };
  const nextState = resolveStateAfterEpisodeChange(previousStatus?.state ?? null, progress, toMark.length > 0);
  const trackingStart = previousStatus?.startedAt ?? (toMark.length > 0 ? new Date() : null);

  await writeSeriesStatus(userId, season.seriesId, nextState, progress, {
    touchLastActivity: toMark.length > 0,
    touchLastWatched: toMark.length > 0,
    trackingStart
  });

  if (progress.completed && previousStatus?.state !== "COMPLETED") {
    await recordActivity({ userId, type: "SERIES_COMPLETED", seriesId: season.seriesId, metadata: { from: previousStatus?.state ?? null } });
    await notifySeriesCompleted(userId, season.seriesId);
    await recordGamificationEvent({ type: "SERIES_COMPLETED", userId, seriesId: season.seriesId });
  }

  invalidateRecommendationCache(userId);
  invalidateStatsCache(userId);
  invalidateWrappedCache(userId);

  return { seriesId: season.seriesId, markedCount: toMark.length, progress };
}

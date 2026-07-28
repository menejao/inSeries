import { prisma } from "@/lib/db/prisma";
import { ensureSeriesExists, ensureSeasonEpisodesSynced } from "@/lib/catalog/repository";
import { calculateSeriesProgress } from "@/lib/progress/calculate";
import type { ConflictPolicy, ImportReport, MatchedSeries } from "@/lib/import/types";

/**
 * Fases 18/22/23/27/37/38 — aplica UMA serie do manifesto por vez (o route de execucao chama
 * em lote de N series por request, com checkpoint em ImportJob.processedCount — jobs longos
 * sobrevivem ao timeout de function do plano Hobby porque o cliente re-chama ate terminar).
 *
 * Regras: nunca gera Activity por episodio importado (Feed nao e inundado — Fase 38);
 * upserts sao idempotentes (importar o mesmo arquivo 2x nao duplica nada — Fase 23);
 * episodio ja assistido preserva o watchedAt existente; datas do arquivo sao preservadas
 * quando presentes (Fase 21).
 */

export async function applySeries(
  userId: string,
  group: MatchedSeries,
  policy: ConflictPolicy,
  report: ImportReport
): Promise<void> {
  if (group.skipped || group.confidence === "ambiguous" || group.confidence === "not_found" || !group.tmdbId) {
    report.skippedSeries += 1;
    return;
  }

  // Fase 18 — criacao sob demanda, reusando a mesma operacao idempotente da busca hibrida.
  let seriesId = group.localSeriesId;
  if (!seriesId) {
    const series = await ensureSeriesExists(group.tmdbId);
    seriesId = series.id;
    report.seriesCreated += 1;
  } else {
    report.seriesMatched += 1;
  }

  // Episodios: garante que as temporadas referenciadas existem com episodios antes de marcar.
  const neededSeasons = Array.from(new Set(group.episodes.map((episode) => episode.seasonNumber)));
  for (const seasonNumber of neededSeasons) {
    await ensureSeasonEpisodesSynced(seriesId, seasonNumber);
  }

  if (group.episodes.length) {
    const episodes = await prisma.episode.findMany({
      where: { season: { seriesId, number: { in: neededSeasons } } },
      select: { id: true, number: true, season: { select: { number: true } } }
    });
    const byKey = new Map(episodes.map((episode) => [`${episode.season.number}:${episode.number}`, episode.id]));

    for (const item of group.episodes) {
      const episodeId = byKey.get(`${item.seasonNumber}:${item.episodeNumber}`);
      if (!episodeId) continue; // episodio nao existe no TMDb (numeracao divergente) — reportado no total geral

      const existing = await prisma.userEpisodeProgress.findUnique({
        where: { userId_episodeId: { userId, episodeId } },
        select: { id: true, watched: true }
      });

      if (existing?.watched) {
        report.episodesAlreadyWatched += 1;
        continue;
      }

      const watchedAt = item.watchedAt ? new Date(item.watchedAt) : new Date();
      if (existing) {
        await prisma.userEpisodeProgress.update({ where: { id: existing.id }, data: { watched: true, watchedAt } });
      } else {
        const created = await prisma.userEpisodeProgress.create({
          data: { userId, episodeId, watched: true, watchedAt }
        });
        report.createdProgressIds.push(created.id);
      }
      report.episodesMarked += 1;
    }
  }

  // Avaliacao (Fase 20/25) — conflito resolvido pela politica escolhida.
  if (group.rating !== undefined) {
    const existing = await prisma.rating.findUnique({
      where: { userId_seriesId: { userId, seriesId } },
      select: { id: true, value: true }
    });
    if (!existing) {
      const created = await prisma.rating.create({ data: { userId, seriesId, value: group.rating } });
      report.createdRatingIds.push(created.id);
      report.ratingsImported += 1;
    } else if (existing.value !== group.rating) {
      if (policy === "use_imported" || policy === "use_newest") {
        await prisma.rating.update({ where: { id: existing.id }, data: { value: group.rating } });
        report.ratingsImported += 1;
      } else {
        report.ratingsSkippedConflict += 1;
      }
    }
  }

  // Status (Fase 24) + recalc de progresso (Fase 37) — SEM Activity/notificacao (Fase 38).
  const progress = await calculateSeriesProgress(userId, seriesId);
  const existingStatus = await prisma.userSeriesStatus.findUnique({
    where: { userId_seriesId: { userId, seriesId } },
    select: { id: true, state: true }
  });

  const importedState = group.status ?? (progress?.completed ? "COMPLETED" : group.episodes.length ? "WATCHING" : group.watchlist ? "WANT_TO_WATCH" : undefined);

  if (importedState) {
    const shouldApply = !existingStatus || policy === "use_imported" || policy === "use_newest" || existingStatus.state === importedState;
    if (!existingStatus) {
      const created = await prisma.userSeriesStatus.create({
        data: {
          userId,
          seriesId,
          state: importedState,
          completionPercent: progress?.percentage ?? 0,
          lastActivityAt: new Date(),
          completedAt: importedState === "COMPLETED" ? new Date() : null
        }
      });
      report.createdStatusIds.push(created.id);
      report.statusesApplied += 1;
    } else if (shouldApply) {
      await prisma.userSeriesStatus.update({
        where: { id: existingStatus.id },
        data: {
          state: importedState,
          completionPercent: progress?.percentage ?? 0,
          lastActivityAt: new Date(),
          completedAt: importedState === "COMPLETED" ? new Date() : null
        }
      });
      report.statusesApplied += 1;
    } else {
      // keep_existing: so atualiza o percentual (recalculo nunca e um conflito).
      await prisma.userSeriesStatus.update({
        where: { id: existingStatus.id },
        data: { completionPercent: progress?.percentage ?? 0 }
      });
    }
  } else if (existingStatus) {
    await prisma.userSeriesStatus.update({
      where: { id: existingStatus.id },
      data: { completionPercent: progress?.percentage ?? 0 }
    });
  }

  // Listas (Fase 26) — reusa lista existente com o mesmo titulo, nunca sobrescreve.
  for (const listName of group.listNames) {
    let list = await prisma.list.findFirst({ where: { userId, title: listName }, select: { id: true } });
    if (!list) {
      list = await prisma.list.create({ data: { userId, title: listName, visibility: "PRIVATE" }, select: { id: true } });
      report.createdListIds.push(list.id);
      report.listsCreated += 1;
    }
    const alreadyInList = await prisma.listItem.findUnique({
      where: { listId_seriesId: { listId: list.id, seriesId } },
      select: { id: true }
    });
    if (!alreadyInList) {
      const maxPosition = await prisma.listItem.aggregate({ where: { listId: list.id }, _max: { position: true } });
      await prisma.listItem.create({
        data: { listId: list.id, seriesId, position: (maxPosition._max.position ?? 0) + 1 }
      });
      report.listItemsAdded += 1;
    }
  }
}

/** Fase 33 — desfaz uma importacao removendo APENAS os registros que ela criou. */
export async function undoImport(userId: string, report: ImportReport) {
  await prisma.$transaction([
    prisma.userEpisodeProgress.deleteMany({ where: { userId, id: { in: report.createdProgressIds } } }),
    prisma.rating.deleteMany({ where: { userId, id: { in: report.createdRatingIds } } }),
    prisma.userSeriesStatus.deleteMany({ where: { userId, id: { in: report.createdStatusIds } } }),
    prisma.list.deleteMany({ where: { userId, id: { in: report.createdListIds } } })
  ]);
}

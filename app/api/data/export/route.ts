import { NextResponse } from "next/server";
import { ExternalEntityType, ExternalSource } from "@prisma/client";
import { getApiUser } from "@/lib/auth/server";
import { prisma } from "@/lib/db/prisma";
import { csvSafeCell } from "@/lib/import/csv-parse";
import { INSERIES_SCHEMA_VERSION } from "@/lib/import/adapters";
import { withApiObservability } from "@/lib/http/api-handler";

/**
 * Fase 34 — exportacao. `format=json` e o backup oficial completo (re-importavel pelo
 * adaptador `inseries`); `format=history-csv`/`ratings-csv` sao recortes tabulares.
 * Nunca inclui: senha/hash, tokens, sessoes, dados de outros usuarios (Fase 34) — todos os
 * selects abaixo sao explicitos, nada de `include` amplo.
 */

async function tmdbIdsForSeries(seriesIds: string[]) {
  const mappings = await prisma.externalSourceMapping.findMany({
    where: { seriesId: { in: seriesIds }, source: ExternalSource.TMDB, entityType: ExternalEntityType.SERIES },
    select: { seriesId: true, externalId: true }
  });
  return new Map(mappings.map((mapping) => [mapping.seriesId, mapping.externalId]));
}

async function getHandler(request: Request) {
  const user = await getApiUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const format = searchParams.get("format") ?? "json";

  const [statuses, progress, ratings, lists] = await Promise.all([
    prisma.userSeriesStatus.findMany({
      where: { userId: user.id },
      select: { state: true, completionPercent: true, series: { select: { id: true, title: true, firstAirYear: true } } }
    }),
    prisma.userEpisodeProgress.findMany({
      where: { userId: user.id, watched: true },
      select: {
        watchedAt: true,
        episode: { select: { number: true, title: true, season: { select: { number: true, series: { select: { id: true, title: true } } } } } }
      }
    }),
    prisma.rating.findMany({
      where: { userId: user.id },
      select: { value: true, updatedAt: true, series: { select: { id: true, title: true } } }
    }),
    prisma.list.findMany({
      where: { userId: user.id },
      select: { title: true, description: true, visibility: true, items: { select: { series: { select: { id: true, title: true } } }, orderBy: { position: "asc" } } }
    })
  ]);

  const allSeriesIds = Array.from(
    new Set([
      ...statuses.map((status) => status.series.id),
      ...progress.map((row) => row.episode.season.series.id),
      ...ratings.map((rating) => rating.series.id),
      ...lists.flatMap((list) => list.items.map((item) => item.series.id))
    ])
  );
  const tmdbIds = await tmdbIdsForSeries(allSeriesIds);
  const ratingBySeriesId = new Map(ratings.map((rating) => [rating.series.id, rating.value]));

  if (format === "history-csv") {
    const lines = ["Titulo,Temporada,Episodio,Data assistida,TMDB ID"];
    for (const row of progress) {
      const series = row.episode.season.series;
      lines.push(
        [
          csvSafeCell(series.title),
          String(row.episode.season.number),
          String(row.episode.number),
          row.watchedAt ? row.watchedAt.toISOString() : "",
          tmdbIds.get(series.id) ?? ""
        ].join(",")
      );
    }
    return new NextResponse(lines.join("\n"), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="inseries-historico.csv"'
      }
    });
  }

  if (format === "ratings-csv") {
    const lines = ["Titulo,Nota,Atualizada em,TMDB ID"];
    for (const rating of ratings) {
      lines.push(
        [csvSafeCell(rating.series.title), String(rating.value), rating.updatedAt.toISOString(), tmdbIds.get(rating.series.id) ?? ""].join(",")
      );
    }
    return new NextResponse(lines.join("\n"), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="inseries-avaliacoes.csv"'
      }
    });
  }

  // Backup oficial JSON (Fase 9/34) — o formato que o adaptador `inseries` re-importa.
  const backup = {
    schema_version: INSERIES_SCHEMA_VERSION,
    exported_at: new Date().toISOString(),
    user: { username: user.username, name: user.name },
    series: statuses.map((status) => ({
      tmdbId: tmdbIds.get(status.series.id),
      title: status.series.title,
      year: status.series.firstAirYear ?? undefined,
      status: status.state,
      rating: ratingBySeriesId.get(status.series.id)
    })),
    episodes: progress.map((row) => ({
      tmdbId: tmdbIds.get(row.episode.season.series.id),
      seriesTitle: row.episode.season.series.title,
      seasonNumber: row.episode.season.number,
      episodeNumber: row.episode.number,
      watchedAt: row.watchedAt?.toISOString()
    })),
    lists: lists.map((list) => ({
      title: list.title,
      description: list.description,
      visibility: list.visibility,
      items: list.items.map((item) => ({ tmdbId: tmdbIds.get(item.series.id), title: item.series.title }))
    }))
  };

  return new NextResponse(JSON.stringify(backup, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": 'attachment; filename="inseries-backup.json"'
    }
  });
}

export const GET = withApiObservability("data.export", getHandler);

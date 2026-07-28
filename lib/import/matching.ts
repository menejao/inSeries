import { ExternalEntityType, ExternalSource } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { searchTmdbSeries, findTmdbSeriesByImdbId } from "@/lib/tmdb/service";
import type { AnalyzedManifest, ImportItem, ImportManifest, MatchedSeries } from "@/lib/import/types";

/**
 * Fases 14/15 — correspondencia por prioridade: TMDB ID (confirmed) > IMDb ID via /find
 * (confirmed) > titulo+ano no TMDb com 1 resultado compativel (probable) > multiplos
 * resultados plausiveis (ambiguous, exige revisao) > nada (not_found). Nada ambiguo e
 * aplicado silenciosamente — na execucao, ambiguous/not_found sao pulados e reportados.
 */

function groupKey(item: ImportItem): string {
  if (item.tmdbId) return `tmdb:${item.tmdbId}`;
  if (item.imdbId) return `imdb:${item.imdbId}`;
  return `title:${(item.title ?? "").toLowerCase().trim()}|${item.year ?? ""}`;
}

/** Agrupa ImportItems por serie (uma serie pode ter N episodios + rating + status no mesmo arquivo). */
export function groupItems(manifest: ImportManifest): MatchedSeries[] {
  const groups = new Map<string, MatchedSeries>();

  for (const item of manifest.items) {
    if (item.mediaType === "movie") continue;
    const key = groupKey(item);
    let group = groups.get(key);
    if (!group) {
      group = {
        key,
        title: item.title ?? item.tmdbId ?? item.imdbId ?? "?",
        year: item.year,
        tmdbId: item.tmdbId,
        confidence: "not_found",
        episodes: [],
        listNames: []
      };
      groups.set(key, group);
    }

    if (item.year && !group.year) group.year = item.year;
    if (item.title && (group.title === "?" || !group.title)) group.title = item.title;

    if (item.mediaType === "episode" && item.seasonNumber != null && item.episodeNumber != null && item.watched !== false) {
      // Dedup dentro do proprio arquivo (Fase 23): mesmo S/E so entra uma vez, mantendo a data mais antiga.
      const exists = group.episodes.find((episode) => episode.seasonNumber === item.seasonNumber && episode.episodeNumber === item.episodeNumber);
      if (!exists) {
        group.episodes.push({ seasonNumber: item.seasonNumber, episodeNumber: item.episodeNumber, watchedAt: item.watchedAt });
      } else if (item.watchedAt && (!exists.watchedAt || item.watchedAt < exists.watchedAt)) {
        exists.watchedAt = item.watchedAt;
      }
    }
    if (item.rating !== undefined) group.rating = item.rating;
    if (item.status) group.status = item.status;
    if (item.favorite) group.favorite = true;
    if (item.watchlist) group.watchlist = true;
    if (item.listName && !group.listNames.includes(item.listName)) group.listNames.push(item.listName);
  }

  return Array.from(groups.values());
}

async function localSeriesIdByTmdbId(tmdbId: string): Promise<string | undefined> {
  const mapping = await prisma.externalSourceMapping.findUnique({
    where: {
      source_entityType_externalId: {
        source: ExternalSource.TMDB,
        entityType: ExternalEntityType.SERIES,
        externalId: tmdbId
      }
    },
    select: { seriesId: true }
  });
  return mapping?.seriesId;
}

async function matchOne(group: MatchedSeries): Promise<MatchedSeries> {
  // 1. TMDB ID direto — confirmed.
  if (group.tmdbId) {
    return { ...group, confidence: "confirmed", localSeriesId: await localSeriesIdByTmdbId(group.tmdbId) };
  }

  // 2. IMDb ID via /find — confirmed.
  if (group.key.startsWith("imdb:")) {
    const imdbId = group.key.slice(5);
    try {
      const found = await findTmdbSeriesByImdbId(imdbId);
      if (found) {
        const tmdbId = String(found.id);
        return {
          ...group,
          tmdbId,
          title: group.title === "?" ? found.name : group.title,
          confidence: "confirmed",
          localSeriesId: await localSeriesIdByTmdbId(tmdbId)
        };
      }
    } catch {
      // TMDb indisponivel: cai pro fluxo de titulo abaixo.
    }
  }

  // 3. Titulo (+ano) no TMDb.
  if (!group.title || group.title === "?") return { ...group, confidence: "not_found" };
  try {
    const results = await searchTmdbSeries(group.title);
    if (!results.length) return { ...group, confidence: "not_found" };

    const normalizedTitle = group.title.toLowerCase().trim();
    const plausible = results.filter((result) => {
      const nameMatches =
        result.name?.toLowerCase().trim() === normalizedTitle || result.original_name?.toLowerCase().trim() === normalizedTitle;
      if (!group.year) return nameMatches;
      const resultYear = result.first_air_date ? Number(result.first_air_date.slice(0, 4)) : undefined;
      return nameMatches && (resultYear === undefined || Math.abs(resultYear - group.year) <= 1);
    });

    const pool = plausible.length ? plausible : results.slice(0, 3);

    if (pool.length === 1 && plausible.length === 1) {
      const tmdbId = String(pool[0].id);
      return { ...group, tmdbId, confidence: "probable", localSeriesId: await localSeriesIdByTmdbId(tmdbId) };
    }

    // Fase 15/16 — mais de uma serie possivel (remakes UK/US, mesmo titulo em anos diferentes): revisao manual.
    return {
      ...group,
      confidence: "ambiguous",
      candidates: pool.slice(0, 4).map((result) => ({
        tmdbId: String(result.id),
        title: result.name,
        year: result.first_air_date ? Number(result.first_air_date.slice(0, 4)) : undefined
      }))
    };
  } catch {
    return { ...group, confidence: "not_found" };
  }
}

export async function matchManifest(manifest: ImportManifest): Promise<AnalyzedManifest> {
  const groups = groupItems(manifest);
  const matched: MatchedSeries[] = [];

  // Sequencial de proposito: respeita rate limit do TMDb (1 busca por serie desconhecida).
  for (const group of groups) {
    matched.push(await matchOne(group));
  }

  const ignoredItems = manifest.items.filter((item) => item.mediaType === "movie").length;

  return {
    source: manifest.source,
    fileName: manifest.fileName,
    series: matched,
    warnings: manifest.warnings,
    errors: manifest.errors,
    ignoredItems
  };
}

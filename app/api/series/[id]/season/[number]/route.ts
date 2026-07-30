import { NextResponse } from "next/server";
import { getSeasonEpisodes } from "@/lib/catalog/repository";
import { getApiUser } from "@/lib/auth/server";
import { prisma } from "@/lib/db/prisma";
import { canUseDatabase } from "@/lib/db/health";
import { withApiObservability } from "@/lib/http/api-handler";

/**
 * Fase 25 (INSERIES-CATALOG-SERIES-EXPERIENCE-01) — episodios de UMA temporada, buscados
 * pelo `SeasonSelector` (client) so quando o usuario troca de aba. Nunca retorna episodios de
 * outras temporadas.
 */
async function seasonEpisodesHandler(request: Request, { params }: { params: Promise<{ id: string; number: string }> }) {
  const { id, number } = await params;
  const seasonNumber = Number(number);
  if (!Number.isFinite(seasonNumber)) {
    return NextResponse.json({ error: "invalid_season" }, { status: 400 });
  }

  const episodes = await getSeasonEpisodes(id, seasonNumber);

  const user = await getApiUser();
  if (!user || !(await canUseDatabase()) || !episodes.length) {
    return NextResponse.json({ data: episodes });
  }

  const watchedRows = await prisma.userEpisodeProgress.findMany({
    where: { userId: user.id, episodeId: { in: episodes.map((episode) => episode.id) }, watched: true },
    select: { episodeId: true, watchedAt: true }
  });
  const watchedMap = new Map(watchedRows.map((row) => [row.episodeId, row.watchedAt]));

  return NextResponse.json({
    data: episodes.map((episode) => ({
      ...episode,
      watched: watchedMap.has(episode.id),
      watchedAt: watchedMap.get(episode.id)?.toISOString() ?? null
    }))
  });
}

export const GET = withApiObservability("series.season-episodes", seasonEpisodesHandler);

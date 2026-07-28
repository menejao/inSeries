import { NextResponse } from "next/server";
import { getApiUser } from "@/lib/auth/server";
import { prisma } from "@/lib/db/prisma";
import { withApiObservability } from "@/lib/http/api-handler";

/**
 * Fase 36 — analise de duplicacoes. Constraints unicas do schema ja impedem duplicata exata
 * (userId+episodeId, userId+seriesId, listId+seriesId), entao o que sobra pra detectar sao
 * inconsistencias LOGICAS: series com titulo identico no catalogo (correspondencia potencial
 * errada), progresso marcado em serie sem status, status COMPLETED com progresso < 100%.
 */
async function getHandler() {
  const user = await getApiUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const statuses = await prisma.userSeriesStatus.findMany({
    where: { userId: user.id },
    select: { state: true, completionPercent: true, series: { select: { id: true, title: true, firstAirYear: true, slug: true } } }
  });

  // Series do usuario com titulo duplicado no proprio acompanhamento (possivel matching errado).
  const byTitle = new Map<string, typeof statuses>();
  for (const status of statuses) {
    const key = status.series.title.toLowerCase().trim();
    byTitle.set(key, [...(byTitle.get(key) ?? []), status]);
  }
  const duplicateTitles = Array.from(byTitle.values())
    .filter((group) => group.length > 1)
    .map((group) => ({
      title: group[0].series.title,
      series: group.map((status) => ({ slug: status.series.slug, year: status.series.firstAirYear, state: status.state }))
    }));

  const inconsistentCompleted = statuses
    .filter((status) => status.state === "COMPLETED" && status.completionPercent < 100)
    .map((status) => ({ title: status.series.title, slug: status.series.slug, completionPercent: status.completionPercent }));

  const progressWithoutStatus = await prisma.userEpisodeProgress.findMany({
    where: {
      userId: user.id,
      watched: true,
      episode: { season: { series: { statuses: { none: { userId: user.id } } } } }
    },
    select: { episode: { select: { season: { select: { series: { select: { title: true, slug: true } } } } } } },
    take: 50
  });
  const orphanSeries = Array.from(
    new Map(
      progressWithoutStatus.map((row) => [row.episode.season.series.slug, { title: row.episode.season.series.title, slug: row.episode.season.series.slug }])
    ).values()
  );

  return NextResponse.json({
    data: {
      duplicateTitles,
      inconsistentCompleted,
      orphanSeries
    }
  });
}

export const GET = withApiObservability("data.duplicates", getHandler);

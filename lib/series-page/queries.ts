import { prisma } from "@/lib/db/prisma";
import type { NormalizedCastMember, NormalizedVideo } from "@/lib/catalog/normalize";

/**
 * Fase 10 (INSERIES-SERIES-PAGE-PREMIUM-01) — the one genuinely new query this sprint
 * adds: when the current user first added this series to any of their own lists. Every
 * other timeline input (startedAt, watched episodes, review) is already fetched by the
 * series detail page for other sections.
 */
export async function getSeriesAddedToListAt(userId: string, seriesId: string): Promise<Date | null> {
  const item = await prisma.listItem.findFirst({
    where: { seriesId, list: { userId } },
    orderBy: { createdAt: "asc" },
    select: { createdAt: true }
  });
  return item?.createdAt ?? null;
}

/** Fase 2 (INSERIES-SERIES-PAGE-PREMIUM-01) — "Adicionar a Lista" button needs the user's own lists to pick from; reuses the same List model the /lists pages already query. */
export async function getUserListsForSeries(userId: string, seriesId: string) {
  const lists = await prisma.list.findMany({
    where: { userId },
    select: { id: true, title: true, items: { where: { seriesId }, select: { id: true } } },
    orderBy: { updatedAt: "desc" }
  });

  return lists.map((list) => ({ id: list.id, title: list.title, containsSeries: list.items.length > 0 }));
}

export type SeriesMedia = {
  cast: NormalizedCastMember[];
  videos: NormalizedVideo[];
  backdropUrls: string[];
  posterUrls: string[];
};

/**
 * Fase 17/18/19 (INSERIES-CATALOG-SERIES-EXPERIENCE-01) — elenco/galeria/trailers buscados
 * direto (so os 4 campos), sem passar pelo tipo `Series` compartilhado (que o catalogo/busca
 * tambem usam) — evita inflar toda pagina/lista que reaproveita esse tipo com dados que so a
 * pagina da serie precisa.
 */
export async function getSeriesMedia(seriesId: string): Promise<SeriesMedia> {
  const row = await prisma.series.findUnique({
    where: { id: seriesId },
    select: { cast: true, videos: true, backdropUrls: true, posterUrls: true }
  });

  return {
    cast: (row?.cast ?? []) as unknown as NormalizedCastMember[],
    videos: (row?.videos ?? []) as unknown as NormalizedVideo[],
    backdropUrls: row?.backdropUrls ?? [],
    posterUrls: row?.posterUrls ?? []
  };
}

import { prisma } from "@/lib/db/prisma";

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

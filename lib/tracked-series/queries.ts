import type { WatchState } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { classifyTrackedSeries } from "@/lib/tracked-series/classify";
import type { TrackedSeriesSummaryItem } from "@/lib/tracked-series/types";

/** Fase 10 (INSERIES-DASHBOARD-OPERATIONAL-EXPERIENCE-04) — mesmos estados "ativos" do Watch Next. */
const ELIGIBLE_STATES: WatchState[] = ["WATCHING", "WANT_TO_WATCH", "PAUSED"];

/**
 * "Séries acompanhadas" (Fase 10) — resume o *estado* de cada série que o usuário acompanha,
 * não uma lista de episódios. Deliberadamente uma query própria, não uma reutilização de
 * `getWatchNextForUser`: aquela só retorna séries com episódio pendente (por construção),
 * então nunca cobriria "aguardando nova temporada" ou "temporada concluída" — os dois estados
 * que só existem quando NÃO há nada pendente. "Não replicar o Catálogo ou Assistir a seguir"
 * (Fase 10 explicito): nunca busca todos os episódios de uma vez pra listar, só o suficiente
 * pra classificar em qual dos 5 estados a série está (a classificação em si é
 * `classifyTrackedSeries`, pura e testada — esta função só busca o dado).
 */
export async function getTrackedSeriesSummaryForUser(userId: string): Promise<TrackedSeriesSummaryItem[]> {
  const statuses = await prisma.userSeriesStatus.findMany({
    where: { userId, state: { in: ELIGIBLE_STATES } },
    include: {
      series: {
        select: {
          id: true,
          slug: true,
          title: true,
          posterUrl: true,
          status: true,
          seasons: {
            orderBy: { number: "asc" },
            select: {
              episodes: {
                orderBy: { number: "asc" },
                select: { airedAt: true, progress: { where: { userId }, select: { watched: true } } }
              }
            }
          }
        }
      }
    }
  });

  const now = new Date();
  const items: TrackedSeriesSummaryItem[] = statuses.map((status) => {
    const episodes = status.series.seasons
      .flatMap((season) => season.episodes)
      .map((episode) => ({ airedAt: episode.airedAt, watched: episode.progress[0]?.watched ?? false }));
    const classification = classifyTrackedSeries(episodes, status.series.status, now);

    return {
      series: { id: status.series.id, slug: status.series.slug, title: status.series.title, posterUrl: status.series.posterUrl },
      ...classification,
      lastActivityAt: status.lastActivityAt
    };
  });

  // Mais ativo primeiro — mesmo criterio de ordenacao de Continuar Assistindo (Fase 3, lib/continue-watching/queries.ts).
  items.sort((a, b) => (b.lastActivityAt?.getTime() ?? 0) - (a.lastActivityAt?.getTime() ?? 0));

  return items;
}

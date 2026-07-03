import Link from "next/link";
import { notFound } from "next/navigation";
import { EpisodeRow } from "@/components/series/episode-row";
import { EmptyState } from "@/components/ui/empty-state";
import { ChevronLeftIcon } from "@/components/ui/icons";
import { getCurrentUser } from "@/lib/auth/server";
import { getCatalogSeriesBySlug } from "@/lib/catalog/repository";
import { prisma } from "@/lib/db/prisma";
import { canUseDatabase } from "@/lib/db/health";

export default async function SeasonPage({
  params
}: {
  params: Promise<{ id: string; season: string }>;
}) {
  const { id, season } = await params;
  const series = await getCatalogSeriesBySlug(id);
  const user = await getCurrentUser();
  const selectedSeason = series?.seasons.find((item) => item.number === Number(season));

  if (!series || !selectedSeason) notFound();

  const watchedMap = user && (await canUseDatabase())
    ? new Set(
        (
          await prisma.userEpisodeProgress.findMany({
            where: {
              userId: user.id,
              episodeId: {
                in: selectedSeason.episodes.map((episode) => episode.id)
              },
              watched: true
            }
          })
        ).map((item) => item.episodeId)
      )
    : new Set<string>();

  return (
    <div className="space-y-6">
      <Link href={`/series/${series.slug}`} className="inline-flex items-center gap-1 text-sm font-medium text-muted transition hover:text-ink">
        <ChevronLeftIcon className="h-4 w-4" />
        {series.title}
      </Link>
      <div>
        <p className="eyebrow">Temporada {selectedSeason.number}</p>
        <h1 className="section-title">{selectedSeason.title}</h1>
        <p className="section-copy">{selectedSeason.episodes.length} episodio(s) nesta temporada.</p>
      </div>
      <div className="grid gap-4">
        {selectedSeason.episodes.length ? (
          selectedSeason.episodes.map((episode) => (
            <EpisodeRow
              key={episode.id}
              episode={{ ...episode, watched: watchedMap.has(episode.id) }}
              seasonNumber={selectedSeason.number}
              authenticated={Boolean(user)}
            />
          ))
        ) : (
          <EmptyState title="Sem episodios importados" copy="Rode importacao detalhada para preencher esta temporada." />
        )}
      </div>
    </div>
  );
}

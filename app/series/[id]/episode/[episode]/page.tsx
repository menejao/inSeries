import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ChevronLeftIcon } from "@/components/ui/icons";
import { EpisodeWatchButton } from "@/components/series/episode-watch-button";
import { getCurrentUser } from "@/lib/auth/server";
import { getCatalogSeriesBySlug } from "@/lib/catalog/repository";
import { prisma } from "@/lib/db/prisma";
import { canUseDatabase } from "@/lib/db/health";
import { formatEpisodeCode } from "@/lib/utils";

export default async function EpisodePage({
  params
}: {
  params: Promise<{ id: string; episode: string }>;
}) {
  const { id, episode } = await params;
  const series = await getCatalogSeriesBySlug(id);
  const user = await getCurrentUser();
  const allEpisodes = series?.seasons.flatMap((season) =>
    season.episodes.map((item) => ({ ...item, seasonNumber: season.number }))
  );
  const selectedEpisode = allEpisodes?.find((item) => item.id === episode || String(item.number) === episode);

  if (!series || !selectedEpisode) notFound();

  const watched = user && (await canUseDatabase())
    ? Boolean(
        await prisma.userEpisodeProgress.findUnique({
          where: {
            userId_episodeId: {
              userId: user.id,
              episodeId: selectedEpisode.id
            }
          }
        })
      )
    : false;

  return (
    <div className="space-y-6">
      <Link href={`/series/${series.slug}`} className="inline-flex items-center gap-1 text-sm font-medium text-muted transition hover:text-ink">
        <ChevronLeftIcon className="h-4 w-4" />
        {series.title}
      </Link>
      <Card className="space-y-4">
        <Badge variant="outline">{formatEpisodeCode(selectedEpisode.seasonNumber, selectedEpisode.number)}</Badge>
        <h1 className="section-title">{selectedEpisode.title}</h1>
        <p className="section-copy">{selectedEpisode.overview || "Sinopse indisponivel."}</p>
        <p className="text-sm text-muted">
          Duracao: {selectedEpisode.runtimeMinutes || "n/d"} min · Data: {selectedEpisode.airedOn || "n/d"}
        </p>
        <EpisodeWatchButton episodeId={selectedEpisode.id} initialWatched={watched} authenticated={Boolean(user)} />
      </Card>
    </div>
  );
}

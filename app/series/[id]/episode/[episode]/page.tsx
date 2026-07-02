import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
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
    <Card className="space-y-4">
      <Badge>{formatEpisodeCode(selectedEpisode.seasonNumber, selectedEpisode.number)}</Badge>
      <h1 className="section-title">{selectedEpisode.title}</h1>
      <p className="section-copy">{selectedEpisode.overview}</p>
      <p className="text-sm text-slate-300">
        Duracao: {selectedEpisode.runtimeMinutes || "n/d"} min · Data: {selectedEpisode.airedOn || "n/d"}
      </p>
      <EpisodeWatchButton episodeId={selectedEpisode.id} initialWatched={watched} authenticated={Boolean(user)} />
    </Card>
  );
}

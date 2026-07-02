import { prisma } from "@/lib/db/prisma";
import { createNotification, notificationExists } from "@/lib/notifications/service";

function pad(value: number) {
  return String(value).padStart(2, "0");
}

/**
 * Generates NEW_EPISODE_AVAILABLE notifications for users tracking a series
 * (WATCHING or WANT_TO_WATCH) whose episodes have already aired but weren't
 * watched yet and weren't notified yet. Meant to be run manually/on a schedule
 * (see `npm run notifications:episodes`) — no real cron in this sprint.
 */
export async function generateNewEpisodeAvailableNotifications() {
  const now = new Date();
  const statuses = await prisma.userSeriesStatus.findMany({
    where: { state: { in: ["WATCHING", "WANT_TO_WATCH"] } },
    select: { userId: true, seriesId: true }
  });

  let created = 0;

  for (const status of statuses) {
    const episodes = await prisma.episode.findMany({
      where: { airedAt: { lte: now }, season: { seriesId: status.seriesId } },
      select: {
        id: true,
        number: true,
        title: true,
        season: {
          select: {
            number: true,
            series: { select: { title: true, slug: true } }
          }
        }
      }
    });

    for (const episode of episodes) {
      const progress = await prisma.userEpisodeProgress.findUnique({
        where: { userId_episodeId: { userId: status.userId, episodeId: episode.id } },
        select: { watched: true }
      });
      if (progress?.watched) continue;

      const alreadyNotified = await notificationExists({
        userId: status.userId,
        episodeId: episode.id,
        type: "NEW_EPISODE_AVAILABLE"
      });
      if (alreadyNotified) continue;

      await createNotification({
        userId: status.userId,
        type: "NEW_EPISODE_AVAILABLE",
        title: "Novo episodio disponivel",
        body: `${episode.season.series.title} S${pad(episode.season.number)}E${pad(episode.number)} - ${episode.title} ja esta disponivel.`,
        href: `/series/${episode.season.series.slug}`,
        seriesId: status.seriesId,
        episodeId: episode.id
      });
      created += 1;
    }
  }

  return created;
}

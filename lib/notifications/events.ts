import { prisma } from "@/lib/db/prisma";
import { createNotification } from "@/lib/notifications/service";
import { incrementNotificationsCreated } from "@/lib/metrics/service";

/** Fires once, right after a new Follow row is created (never on a repeat/duplicate follow). */
export async function notifyUserFollowed(followerId: string, followingId: string) {
  const follower = await prisma.user.findUnique({
    where: { id: followerId },
    select: { username: true, name: true }
  });
  if (!follower) return;

  await createNotification({
    userId: followingId,
    type: "FOLLOWED_YOU",
    title: "Novo seguidor",
    body: `${follower.name} (@${follower.username}) comecou a seguir voce.`,
    href: `/profile/${follower.username}`,
    actorUserId: followerId
  });
}

/**
 * Notifies every follower of a review's author, but only when the review is
 * public AND the author's own privacy settings allow their activity/reviews to
 * be seen by others. Never fires for private content or private profiles.
 */
export async function notifyFollowersOfPublicReview(authorId: string, reviewId: string, seriesId: string) {
  const author = await prisma.user.findUnique({
    where: { id: authorId },
    select: { name: true, isProfilePrivate: true, showActivity: true, showReviews: true }
  });
  if (!author || author.isProfilePrivate || !author.showActivity || !author.showReviews) return;

  const series = await prisma.series.findUnique({ where: { id: seriesId }, select: { title: true, slug: true } });
  if (!series) return;

  const followers = await prisma.follow.findMany({ where: { followingId: authorId }, select: { followerId: true } });
  if (followers.length === 0) return;

  await prisma.notification.createMany({
    data: followers.map((follower) => ({
      userId: follower.followerId,
      type: "REVIEW_FROM_FOLLOWING" as const,
      title: "Nova review",
      body: `${author.name} avaliou ${series.title}.`,
      href: `/series/${series.slug}`,
      actorUserId: authorId,
      seriesId,
      reviewId
    }))
  });
  incrementNotificationsCreated(followers.length);
}

/** Same privacy contract as notifyFollowersOfPublicReview, gated by showLists instead of showReviews. */
export async function notifyFollowersOfPublicList(authorId: string, listId: string) {
  const author = await prisma.user.findUnique({
    where: { id: authorId },
    select: { name: true, isProfilePrivate: true, showActivity: true, showLists: true }
  });
  if (!author || author.isProfilePrivate || !author.showActivity || !author.showLists) return;

  const list = await prisma.list.findUnique({ where: { id: listId }, select: { title: true } });
  if (!list) return;

  const followers = await prisma.follow.findMany({ where: { followingId: authorId }, select: { followerId: true } });
  if (followers.length === 0) return;

  await prisma.notification.createMany({
    data: followers.map((follower) => ({
      userId: follower.followerId,
      type: "LIST_FROM_FOLLOWING" as const,
      title: "Nova lista",
      body: `${author.name} criou a lista "${list.title}".`,
      href: "/lists",
      actorUserId: authorId,
      listId
    }))
  });
  incrementNotificationsCreated(followers.length);
}

/** Notifies the user themself; no privacy gate needed since it concerns only their own account. */
export async function notifySeriesCompleted(userId: string, seriesId: string) {
  const series = await prisma.series.findUnique({ where: { id: seriesId }, select: { title: true, slug: true } });
  if (!series) return;

  await createNotification({
    userId,
    type: "SERIES_COMPLETED",
    title: "Serie concluida",
    body: `Voce concluiu ${series.title}.`,
    href: `/series/${series.slug}`,
    seriesId
  });
}

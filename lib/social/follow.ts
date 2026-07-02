import { prisma } from "@/lib/db/prisma";
import { recordActivity } from "@/lib/social/activity";
import { notifyUserFollowed } from "@/lib/notifications/events";

export type FollowResult =
  | { ok: true; following: true }
  | { ok: false; error: "cannot_follow_self" | "user_not_found" };

export async function followUserByUsername(followerId: string, targetUsername: string): Promise<FollowResult> {
  const target = await prisma.user.findUnique({ where: { username: targetUsername }, select: { id: true } });
  if (!target) {
    return { ok: false, error: "user_not_found" };
  }

  if (target.id === followerId) {
    return { ok: false, error: "cannot_follow_self" };
  }

  const existing = await prisma.follow.findUnique({
    where: { followerId_followingId: { followerId, followingId: target.id } }
  });

  if (!existing) {
    await prisma.follow.create({ data: { followerId, followingId: target.id } });
    await recordActivity({ userId: followerId, type: "USER_FOLLOWED", targetUserId: target.id });
    await notifyUserFollowed(followerId, target.id);
  }

  return { ok: true, following: true };
}

export async function unfollowUserByUsername(followerId: string, targetUsername: string) {
  const target = await prisma.user.findUnique({ where: { username: targetUsername }, select: { id: true } });
  if (!target) {
    return { ok: false as const, error: "user_not_found" as const };
  }

  await prisma.follow.deleteMany({
    where: { followerId, followingId: target.id }
  });

  return { ok: true as const, following: false as const };
}

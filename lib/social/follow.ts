import { prisma } from "@/lib/db/prisma";
import { recordActivity } from "@/lib/social/activity";
import { notifyUserFollowed, notifyFollowRequested, notifyFollowRequestAccepted } from "@/lib/notifications/events";
import { recordGamificationEvent } from "@/lib/gamification";
import { isBlockedEitherWay } from "@/lib/social/block";

export type FollowState = "self" | "following" | "requested" | "none";

/**
 * Fase 4/6/32 (INSERIES-SOCIAL-NETWORK-EXPERIENCE-01) — perfil publico: segue direto (`Follow`
 * criado na hora). Perfil privado: cria uma `FollowRequest` pendente em vez de um `Follow` —
 * so vira `Follow` de verdade quando o dono aceita (`acceptFollowRequest`). Bloqueio nos dois
 * sentidos impede a acao inteira, antes de qualquer outra checagem.
 */
export type FollowResult =
  | { ok: true; state: "following" | "requested" }
  | { ok: false; error: "cannot_follow_self" | "user_not_found" | "blocked" };

export async function followUserByUsername(followerId: string, targetUsername: string): Promise<FollowResult> {
  const target = await prisma.user.findUnique({
    where: { username: targetUsername },
    select: { id: true, isProfilePrivate: true }
  });
  if (!target) return { ok: false, error: "user_not_found" };
  if (target.id === followerId) return { ok: false, error: "cannot_follow_self" };
  if (await isBlockedEitherWay(followerId, target.id)) return { ok: false, error: "blocked" };

  const existing = await prisma.follow.findUnique({
    where: { followerId_followingId: { followerId, followingId: target.id } }
  });
  if (existing) return { ok: true, state: "following" };

  if (target.isProfilePrivate) {
    const existingRequest = await prisma.followRequest.findUnique({
      where: { requesterId_targetId: { requesterId: followerId, targetId: target.id } }
    });
    if (existingRequest?.status === "PENDING") return { ok: true, state: "requested" };

    await prisma.followRequest.upsert({
      where: { requesterId_targetId: { requesterId: followerId, targetId: target.id } },
      update: { status: "PENDING" },
      create: { requesterId: followerId, targetId: target.id, status: "PENDING" }
    });
    await notifyFollowRequested(followerId, target.id);
    return { ok: true, state: "requested" };
  }

  await prisma.follow.create({ data: { followerId, followingId: target.id } });
  await recordActivity({ userId: followerId, type: "USER_FOLLOWED", targetUserId: target.id });
  await notifyUserFollowed(followerId, target.id);
  await recordGamificationEvent({ type: "USER_FOLLOWED", userId: followerId, followingId: target.id });

  return { ok: true, state: "following" };
}

/** Deixar de seguir OU cancelar uma solicitacao pendente — o que existir. */
export async function unfollowUserByUsername(followerId: string, targetUsername: string) {
  const target = await prisma.user.findUnique({ where: { username: targetUsername }, select: { id: true } });
  if (!target) return { ok: false as const, error: "user_not_found" as const };

  await prisma.$transaction([
    prisma.follow.deleteMany({ where: { followerId, followingId: target.id } }),
    prisma.followRequest.updateMany({
      where: { requesterId: followerId, targetId: target.id, status: "PENDING" },
      data: { status: "CANCELLED" }
    })
  ]);

  return { ok: true as const, state: "none" as const };
}

export async function acceptFollowRequest(targetUserId: string, requestId: string) {
  const request = await prisma.followRequest.findUnique({ where: { id: requestId } });
  if (!request || request.targetId !== targetUserId || request.status !== "PENDING") {
    return { ok: false as const, error: "not_found" as const };
  }

  await prisma.$transaction([
    prisma.followRequest.update({ where: { id: requestId }, data: { status: "ACCEPTED" } }),
    prisma.follow.upsert({
      where: { followerId_followingId: { followerId: request.requesterId, followingId: targetUserId } },
      update: {},
      create: { followerId: request.requesterId, followingId: targetUserId }
    })
  ]);
  await recordActivity({ userId: request.requesterId, type: "USER_FOLLOWED", targetUserId });
  await notifyFollowRequestAccepted(targetUserId, request.requesterId);

  return { ok: true as const };
}

export async function rejectFollowRequest(targetUserId: string, requestId: string) {
  const request = await prisma.followRequest.findUnique({ where: { id: requestId } });
  if (!request || request.targetId !== targetUserId || request.status !== "PENDING") {
    return { ok: false as const, error: "not_found" as const };
  }

  await prisma.followRequest.update({ where: { id: requestId }, data: { status: "REJECTED" } });
  return { ok: true as const };
}

export async function getPendingFollowRequests(targetUserId: string) {
  return prisma.followRequest.findMany({
    where: { targetId: targetUserId, status: "PENDING" },
    include: { requester: { select: { id: true, name: true, username: true, avatarUrl: true } } },
    orderBy: { createdAt: "desc" }
  });
}

/** Estado do relacionamento visto pelo `viewerId` em relacao a `targetId` — alimenta o botao Seguir. */
export async function getFollowState(viewerId: string | null, targetId: string): Promise<FollowState> {
  if (!viewerId) return "none";
  if (viewerId === targetId) return "self";

  const follow = await prisma.follow.findUnique({ where: { followerId_followingId: { followerId: viewerId, followingId: targetId } } });
  if (follow) return "following";

  const request = await prisma.followRequest.findUnique({ where: { requesterId_targetId: { requesterId: viewerId, targetId } } });
  if (request?.status === "PENDING") return "requested";

  return "none";
}

/**
 * Fase 12 (INSERIES-SOCIAL-NETWORK-EXPERIENCE-01) — remove so o relacionamento em que
 * `followerUsername` segue `userId` (o inverso de deixar de seguir): nao afeta se `userId`
 * tambem segue `followerUsername`, nao bloqueia, nao notifica.
 */
export async function removeFollower(userId: string, followerUsername: string) {
  const follower = await prisma.user.findUnique({ where: { username: followerUsername }, select: { id: true } });
  if (!follower) return { ok: false as const, error: "user_not_found" as const };

  await prisma.follow.deleteMany({ where: { followerId: follower.id, followingId: userId } });
  return { ok: true as const };
}

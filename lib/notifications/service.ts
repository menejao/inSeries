import type { NotificationType, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";

export type CreateNotificationInput = {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  href?: string | null;
  actorUserId?: string | null;
  seriesId?: string | null;
  episodeId?: string | null;
  reviewId?: string | null;
  listId?: string | null;
  metadata?: Prisma.InputJsonValue;
};

export async function createNotification(input: CreateNotificationInput) {
  return prisma.notification.create({
    data: {
      userId: input.userId,
      type: input.type,
      title: input.title,
      body: input.body,
      href: input.href ?? null,
      actorUserId: input.actorUserId ?? null,
      seriesId: input.seriesId ?? null,
      episodeId: input.episodeId ?? null,
      reviewId: input.reviewId ?? null,
      listId: input.listId ?? null,
      metadata: input.metadata
    }
  });
}

/** Used by call sites that must not create the same notification twice for a given user/event. */
export async function notificationExists(where: Prisma.NotificationWhereInput) {
  const existing = await prisma.notification.findFirst({ where, select: { id: true } });
  return Boolean(existing);
}

const notificationInclude = {
  actorUser: { select: { id: true, username: true, name: true, avatarUrl: true } },
  series: { select: { id: true, slug: true, title: true, posterUrl: true } }
} satisfies Prisma.NotificationInclude;

export type NotificationWithRelations = Prisma.NotificationGetPayload<{ include: typeof notificationInclude }>;

export async function listNotifications(userId: string, limit = 30): Promise<NotificationWithRelations[]> {
  return prisma.notification.findMany({
    where: { userId },
    include: notificationInclude,
    orderBy: { createdAt: "desc" },
    take: limit
  });
}

export async function countUnreadNotifications(userId: string) {
  return prisma.notification.count({ where: { userId, readAt: null } });
}

export type MarkReadResult = { ok: true } | { ok: false; error: "not_found" | "forbidden" };

export async function markNotificationRead(userId: string, notificationId: string): Promise<MarkReadResult> {
  const notification = await prisma.notification.findUnique({
    where: { id: notificationId },
    select: { userId: true, readAt: true }
  });

  if (!notification) return { ok: false, error: "not_found" };
  if (notification.userId !== userId) return { ok: false, error: "forbidden" };

  if (!notification.readAt) {
    await prisma.notification.update({ where: { id: notificationId }, data: { readAt: new Date() } });
  }

  return { ok: true };
}

export async function markAllNotificationsRead(userId: string) {
  await prisma.notification.updateMany({ where: { userId, readAt: null }, data: { readAt: new Date() } });
  return { ok: true as const };
}

/**
 * Prepared for FASE 9 (ADMIN_NOTICE): creates an internal notice for one specific
 * user, or for every user when userId is omitted. No broadcast UI yet — this is
 * only the underlying capability.
 */
export async function createAdminNotice(input: {
  userId?: string;
  title: string;
  body: string;
  href?: string | null;
  metadata?: Prisma.InputJsonValue;
}) {
  if (input.userId) {
    return createNotification({
      userId: input.userId,
      type: "ADMIN_NOTICE",
      title: input.title,
      body: input.body,
      href: input.href,
      metadata: input.metadata
    });
  }

  const users = await prisma.user.findMany({ select: { id: true } });
  if (users.length === 0) return null;

  await prisma.notification.createMany({
    data: users.map((user) => ({
      userId: user.id,
      type: "ADMIN_NOTICE" as const,
      title: input.title,
      body: input.body,
      href: input.href ?? null,
      metadata: input.metadata
    }))
  });

  return null;
}

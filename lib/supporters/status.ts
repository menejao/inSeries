import { prisma } from "@/lib/db/prisma";

export type SupporterStatusSummary = {
  active: boolean;
  startedAt: Date | null;
  expiresAt: Date | null;
  showBadge: boolean;
};

const RENEWAL_DAYS = 30;
const RENEWAL_MS = RENEWAL_DAYS * 24 * 60 * 60 * 1000;

/**
 * "Nunca perder dias restantes": pure renewal math, split out from `grantOrExtendSupporter` so
 * it's testable without a database. Stacks 30 days on top of the current expiry when there's
 * still time left; otherwise starts the new 30-day window from `now`.
 */
export function computeRenewedExpiry(now: Date, current: { status: string; expiresAt: Date } | null): Date {
  const base = current && current.status === "ACTIVE" && current.expiresAt > now ? current.expiresAt : now;
  return new Date(base.getTime() + RENEWAL_MS);
}

/**
 * INSERIES-SUPPORTER-ACTIVATION-01 — the one place every benefit/API reads. Lazily flips an
 * expired ACTIVE row to EXPIRED on read (no cron configured in this environment) so `active`
 * always reflects reality even if nothing else touched the row since `expiresAt` passed.
 */
export async function getSupporterStatus(userId: string): Promise<SupporterStatusSummary> {
  const [supporter, user] = await Promise.all([
    prisma.userSupporter.findUnique({ where: { userId } }),
    prisma.user.findUnique({ where: { id: userId }, select: { showSupporterBadge: true } })
  ]);

  const showBadge = user?.showSupporterBadge ?? true;
  if (!supporter) return { active: false, startedAt: null, expiresAt: null, showBadge };

  if (supporter.status === "ACTIVE" && supporter.expiresAt <= new Date()) {
    await prisma.userSupporter.update({ where: { userId }, data: { status: "EXPIRED" } });
    return { active: false, startedAt: supporter.startedAt, expiresAt: supporter.expiresAt, showBadge };
  }

  return {
    active: supporter.status === "ACTIVE",
    startedAt: supporter.startedAt,
    expiresAt: supporter.expiresAt,
    showBadge
  };
}

/** Batch variant for list rendering (profile lists, review/comment authors) — one query, not N. */
export async function getActiveSupporterUserIds(userIds: string[]): Promise<Set<string>> {
  if (!userIds.length) return new Set();
  const rows = await prisma.userSupporter.findMany({
    where: { userId: { in: userIds }, status: "ACTIVE", expiresAt: { gt: new Date() } },
    select: { userId: true }
  });
  return new Set(rows.map((row) => row.userId));
}

/**
 * INSERIES-SUPPORTER-ACTIVATION-01 — "Nunca perder dias restantes": if the user still has time
 * left, the new 30 days stack on top of the current `expiresAt` rather than resetting from now.
 * Only ever called from `approveSupportRequest` (admin action) — never from receipt upload.
 */
export async function grantOrExtendSupporter(userId: string, supportRequestId: string) {
  const now = new Date();
  const existing = await prisma.userSupporter.findUnique({ where: { userId } });
  const expiresAt = computeRenewedExpiry(now, existing);

  return prisma.userSupporter.upsert({
    where: { userId },
    create: {
      userId,
      status: "ACTIVE",
      startedAt: now,
      expiresAt,
      source: "PIX",
      supportRequestId
    },
    update: {
      status: "ACTIVE",
      expiresAt,
      supportRequestId
    }
  });
}

import { prisma } from "@/lib/db/prisma";
import { syncActivityVisibility } from "@/lib/social/activity";
import { recordAdminAudit } from "@/lib/admin/audit";

export async function hideReview(adminUserId: string, reviewId: string) {
  const review = await prisma.review.findUnique({ where: { id: reviewId } });
  if (!review) return { ok: false as const, error: "review_not_found" as const };

  await prisma.review.update({ where: { id: reviewId }, data: { hiddenByAdminAt: new Date() } });
  await syncActivityVisibility({ reviewId }, "PRIVATE");
  await recordAdminAudit({ adminUserId, action: "HIDE_REVIEW", entity: "Review", entityId: reviewId });

  return { ok: true as const };
}

export async function restoreReview(adminUserId: string, reviewId: string) {
  const review = await prisma.review.findUnique({ where: { id: reviewId } });
  if (!review) return { ok: false as const, error: "review_not_found" as const };

  await prisma.review.update({ where: { id: reviewId }, data: { hiddenByAdminAt: null } });
  await syncActivityVisibility({ reviewId }, review.visibility);
  await recordAdminAudit({ adminUserId, action: "RESTORE_REVIEW", entity: "Review", entityId: reviewId });

  return { ok: true as const };
}

export async function hideList(adminUserId: string, listId: string) {
  const list = await prisma.list.findUnique({ where: { id: listId } });
  if (!list) return { ok: false as const, error: "list_not_found" as const };

  await prisma.list.update({ where: { id: listId }, data: { hiddenByAdminAt: new Date() } });
  await syncActivityVisibility({ listId }, "PRIVATE");
  await recordAdminAudit({ adminUserId, action: "HIDE_LIST", entity: "List", entityId: listId });

  return { ok: true as const };
}

export async function restoreList(adminUserId: string, listId: string) {
  const list = await prisma.list.findUnique({ where: { id: listId } });
  if (!list) return { ok: false as const, error: "list_not_found" as const };

  await prisma.list.update({ where: { id: listId }, data: { hiddenByAdminAt: null } });
  await syncActivityVisibility({ listId }, list.visibility);
  await recordAdminAudit({ adminUserId, action: "RESTORE_LIST", entity: "List", entityId: listId });

  return { ok: true as const };
}

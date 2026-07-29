import { prisma } from "@/lib/db/prisma";
import { recordAdminAudit } from "@/lib/admin/audit";
import { createAdminNotice } from "@/lib/notifications/service";
import { grantOrExtendSupporter } from "@/lib/supporters/status";

/** Painel administrativo — solicitacoes aguardando analise, mais recentes primeiro. */
export async function listAwaitingReviewRequests() {
  return prisma.supportRequest.findMany({
    where: { status: "AWAITING_REVIEW" },
    include: { user: { select: { id: true, name: true, username: true } } },
    orderBy: { createdAt: "asc" }
  });
}

/** Historico completo (qualquer status) para o painel — mais recentes primeiro, paginado por take. */
export async function listSupportRequests(take = 50) {
  return prisma.supportRequest.findMany({
    include: { user: { select: { id: true, name: true, username: true } } },
    orderBy: { createdAt: "desc" },
    take
  });
}

export type ReviewResult = { ok: true } | { ok: false; error: "not_found" | "already_reviewed" };

/**
 * "Uma solicitacao aprovada nao podera ser aprovada novamente" — only ever transitions out of
 * AWAITING_REVIEW; approving twice, or approving something still PENDING_PAYMENT/already
 * REJECTED/CANCELLED, is rejected outright. This is the only place UserSupporter is ever
 * created/extended (see grantOrExtendSupporter's "never lose remaining days" renewal math).
 */
export async function approveSupportRequest(adminId: string, supportRequestId: string, notes?: string): Promise<ReviewResult> {
  const request = await prisma.supportRequest.findUnique({ where: { id: supportRequestId } });
  if (!request) return { ok: false, error: "not_found" };
  if (request.status !== "AWAITING_REVIEW") return { ok: false, error: "already_reviewed" };

  await prisma.supportRequest.update({
    where: { id: supportRequestId },
    data: { status: "APPROVED", reviewedAt: new Date(), reviewedBy: adminId, notes: notes ?? null }
  });

  const supporter = await grantOrExtendSupporter(request.userId, supportRequestId);

  await recordAdminAudit({
    adminUserId: adminId,
    action: "APPROVE_SUPPORT_REQUEST",
    entity: "SupportRequest",
    entityId: supportRequestId,
    metadata: { userId: request.userId, amountCents: request.amountCents, expiresAt: supporter.expiresAt.toISOString() }
  });

  await createAdminNotice({
    userId: request.userId,
    title: "Apoio confirmado",
    body: "❤️ Seu apoio foi confirmado. Obrigado por apoiar o inSeries!",
    href: "/apoie"
  });

  return { ok: true };
}

export async function rejectSupportRequest(adminId: string, supportRequestId: string, notes?: string): Promise<ReviewResult> {
  const request = await prisma.supportRequest.findUnique({ where: { id: supportRequestId } });
  if (!request) return { ok: false, error: "not_found" };
  if (request.status !== "AWAITING_REVIEW") return { ok: false, error: "already_reviewed" };

  await prisma.supportRequest.update({
    where: { id: supportRequestId },
    data: { status: "REJECTED", reviewedAt: new Date(), reviewedBy: adminId, notes: notes ?? null }
  });

  await recordAdminAudit({
    adminUserId: adminId,
    action: "REJECT_SUPPORT_REQUEST",
    entity: "SupportRequest",
    entityId: supportRequestId,
    metadata: { userId: request.userId, notes: notes ?? null }
  });

  await createAdminNotice({
    userId: request.userId,
    title: "Nao foi possivel confirmar seu apoio",
    body: "Houve um problema na validacao do pagamento. Voce pode tentar novamente na pagina de apoio.",
    href: "/apoie"
  });

  return { ok: true };
}

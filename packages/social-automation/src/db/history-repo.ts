import { prisma } from "./client";
import type { Prisma, SocialAutomationAction, SocialAutomationHistory } from "@prisma/client";

/** INSERIES-SOCIAL-ADMIN-PANEL-03 — filter shape for the history/timeline screen. */
export interface ListHistoryFilters {
  action?: SocialAutomationAction | null;
  contentId?: string | null;
  from?: Date | null;
  to?: Date | null;
  page?: number;
  perPage?: number;
}

export type ListHistoryItem = Prisma.SocialAutomationHistoryGetPayload<{
  include: { content: { select: { id: true; title: true } } };
}>;

export interface ListHistoryResult {
  items: ListHistoryItem[];
  total: number;
  page: number;
  perPage: number;
  pageCount: number;
}

export interface RecordHistoryInput {
  action: SocialAutomationAction;
  contentId?: string | null;
  publicationId?: string | null;
  detail?: Record<string, unknown> | null;
}

export const historyRepo = {
  record(input: RecordHistoryInput): Promise<SocialAutomationHistory> {
    return prisma.socialAutomationHistory.create({
      data: {
        action: input.action,
        contentId: input.contentId ?? null,
        publicationId: input.publicationId ?? null,
        detail: (input.detail ?? undefined) as Prisma.InputJsonValue | undefined
      }
    });
  },

  listForContent(contentId: string): Promise<SocialAutomationHistory[]> {
    return prisma.socialAutomationHistory.findMany({
      where: { contentId },
      orderBy: { createdAt: "asc" }
    });
  },

  listForPublication(publicationId: string): Promise<SocialAutomationHistory[]> {
    return prisma.socialAutomationHistory.findMany({
      where: { publicationId },
      orderBy: { createdAt: "asc" }
    });
  },

  // ---------------------------------------------------------------------------
  // INSERIES-SOCIAL-ADMIN-PANEL-03 — data-layer additions for the admin panel.
  // ---------------------------------------------------------------------------

  async listPaginated(filters: ListHistoryFilters): Promise<ListHistoryResult> {
    const where: Prisma.SocialAutomationHistoryWhereInput = {};
    if (filters.action) where.action = filters.action;
    if (filters.contentId) where.contentId = filters.contentId;
    if (filters.from || filters.to) {
      where.createdAt = {
        ...(filters.from ? { gte: filters.from } : {}),
        ...(filters.to ? { lte: filters.to } : {})
      };
    }

    const page = Math.max(1, filters.page ?? 1);
    const perPage = Math.min(200, Math.max(1, filters.perPage ?? 50));

    const [items, total] = await Promise.all([
      prisma.socialAutomationHistory.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * perPage,
        take: perPage,
        include: { content: { select: { id: true, title: true } } }
      }),
      prisma.socialAutomationHistory.count({ where })
    ]);

    return { items, total, page, perPage, pageCount: Math.max(1, Math.ceil(total / perPage)) };
  },

  async countsByAction(): Promise<Array<{ action: SocialAutomationAction; count: number }>> {
    const rows = await prisma.socialAutomationHistory.groupBy({ by: ["action"], _count: { _all: true } });
    return rows.map((row) => ({ action: row.action, count: row._count._all })).sort((a, b) => b.count - a.count);
  }
};

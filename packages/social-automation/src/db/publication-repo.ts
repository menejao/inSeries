import { prisma } from "./client";
import type { Prisma, SocialPublication, SocialPublicationStatus, SocialNetwork } from "@prisma/client";

/** INSERIES-SOCIAL-ADMIN-PANEL-03 — filter shape for the publications listing screen. */
export interface ListPublicationFilters {
  status?: SocialPublicationStatus | null;
  network?: SocialNetwork | null;
  page?: number;
  perPage?: number;
}

export type ListPublicationItem = Prisma.SocialPublicationGetPayload<{
  include: { content: { select: { id: true; title: true; format: true; status: true } } };
}>;

export interface ListPublicationResult {
  items: ListPublicationItem[];
  total: number;
  page: number;
  perPage: number;
  pageCount: number;
}

export interface CreatePublicationInput {
  contentId: string;
  network: SocialNetwork;
  caption: string;
  mediaRef?: string | null;
  scheduledFor: Date;
}

export const publicationRepo = {
  create(input: CreatePublicationInput): Promise<SocialPublication> {
    return prisma.socialPublication.create({
      data: {
        contentId: input.contentId,
        network: input.network,
        caption: input.caption,
        mediaRef: input.mediaRef ?? null,
        scheduledFor: input.scheduledFor,
        status: "PENDING"
      }
    });
  },

  findById(id: string): Promise<SocialPublication | null> {
    return prisma.socialPublication.findUnique({ where: { id } });
  },

  listDue(before: Date): Promise<SocialPublication[]> {
    return prisma.socialPublication.findMany({
      where: { status: { in: ["PENDING", "SCHEDULED"] }, scheduledFor: { lte: before } },
      orderBy: { scheduledFor: "asc" }
    });
  },

  markPublishing(id: string): Promise<SocialPublication> {
    return prisma.socialPublication.update({ where: { id }, data: { status: "PUBLISHING" } });
  },

  markPublished(id: string, externalId: string): Promise<SocialPublication> {
    return prisma.socialPublication.update({
      where: { id },
      data: { status: "PUBLISHED", publishedAt: new Date(), externalId }
    });
  },

  markFailed(id: string): Promise<SocialPublication> {
    return prisma.socialPublication.update({ where: { id }, data: { status: "FAILED" } });
  },

  updateStatus(id: string, status: SocialPublicationStatus): Promise<SocialPublication> {
    return prisma.socialPublication.update({ where: { id }, data: { status } });
  },

  // -------------------------------------------------------------------------
  // INSERIES-SOCIAL-ADMIN-PANEL-03 — data-layer additions for the admin panel.
  // -------------------------------------------------------------------------

  reschedule(id: string, scheduledFor: Date): Promise<SocialPublication> {
    return prisma.socialPublication.update({ where: { id }, data: { scheduledFor, status: "SCHEDULED" } });
  },

  async listPaginated(filters: ListPublicationFilters): Promise<ListPublicationResult> {
    const where: Prisma.SocialPublicationWhereInput = {};
    if (filters.status) where.status = filters.status;
    if (filters.network) where.network = filters.network;

    const page = Math.max(1, filters.page ?? 1);
    const perPage = Math.min(100, Math.max(1, filters.perPage ?? 20));

    const [items, total] = await Promise.all([
      prisma.socialPublication.findMany({
        where,
        orderBy: { scheduledFor: "desc" },
        skip: (page - 1) * perPage,
        take: perPage,
        include: { content: { select: { id: true, title: true, format: true, status: true } } }
      }),
      prisma.socialPublication.count({ where })
    ]);

    return { items, total, page, perPage, pageCount: Math.max(1, Math.ceil(total / perPage)) };
  },

  /** Publications whose slot falls inside [from, to) — powers the calendar screen. */
  listBetween(from: Date, to: Date) {
    return prisma.socialPublication.findMany({
      where: { scheduledFor: { gte: from, lt: to } },
      orderBy: { scheduledFor: "asc" },
      include: { content: { select: { id: true, title: true, format: true, status: true } } }
    });
  },

  async countsByStatus(): Promise<Record<SocialPublicationStatus, number>> {
    const rows = await prisma.socialPublication.groupBy({ by: ["status"], _count: { _all: true } });
    const result = { PENDING: 0, SCHEDULED: 0, PUBLISHING: 0, PUBLISHED: 0, FAILED: 0 } as Record<SocialPublicationStatus, number>;
    for (const row of rows) result[row.status] = row._count._all;
    return result;
  }
};

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

/**
 * INSERIES-INSTAGRAM-PUBLISHER-05 — bridge for the schema changes proposed by this ticket that have
 * NOT been migrated yet (`SocialPublicationStatus.UPLOADING`/`CANCELLED`, `SocialPublication.attempts`,
 * `SocialPublication.lastError`). Per CLAUDE.md the migration is applied by a human, so the generated
 * Prisma client still describes the old shape and the compiler would reject these values.
 *
 * Rather than leaving the package uncompilable, every such write is funnelled through this ONE
 * helper: the payload is built as a plain object and cast at a single, named, documented boundary.
 * After the migration runs, delete this function and inline the literals — the call sites already
 * read exactly like normal Prisma calls.
 */
type PendingSchemaData = Record<string, unknown>;
function pendingSchema<T>(data: PendingSchemaData): T {
  return data as T;
}

/** Statuses the publisher can write, including the two awaiting migration. */
export type PublisherPublicationStatus = SocialPublicationStatus | "UPLOADING" | "CANCELLED";

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

  // -------------------------------------------------------------------------
  // INSERIES-INSTAGRAM-PUBLISHER-05 — real-publisher state machine. Every write below touches a
  // column/enum value that only exists after this ticket's migration (see `pendingSchema` above).
  // -------------------------------------------------------------------------

  /** PENDING/SCHEDULED -> UPLOADING: media containers are being created on the Graph API. */
  markUploading(id: string): Promise<SocialPublication> {
    return prisma.socialPublication.update({ where: { id }, data: pendingSchema<Prisma.SocialPublicationUpdateInput>({ status: "UPLOADING" }) });
  },

  /** Records one publish attempt and the (already masked) reason it failed. Never a token/payload. */
  markFailedWithError(id: string, lastError: string, attempts: number): Promise<SocialPublication> {
    return prisma.socialPublication.update({
      where: { id },
      data: pendingSchema<Prisma.SocialPublicationUpdateInput>({ status: "FAILED", lastError, attempts })
    });
  },

  /** Success also persists the attempt count and clears the stale error message. */
  markPublishedWithAttempts(id: string, externalId: string, attempts: number): Promise<SocialPublication> {
    return prisma.socialPublication.update({
      where: { id },
      data: pendingSchema<Prisma.SocialPublicationUpdateInput>({
        status: "PUBLISHED",
        publishedAt: new Date(),
        externalId,
        attempts,
        lastError: null
      })
    });
  },

  /** Cancels a not-yet-published slot. The row is never deleted — only its status moves. */
  markCancelled(id: string, reason: string): Promise<SocialPublication> {
    return prisma.socialPublication.update({
      where: { id },
      data: pendingSchema<Prisma.SocialPublicationUpdateInput>({ status: "CANCELLED", lastError: reason })
    });
  },

  /** Monotonic attempt counter, incremented at the start of each real attempt. */
  incrementAttempts(id: string): Promise<SocialPublication> {
    return prisma.socialPublication.update({
      where: { id },
      data: pendingSchema<Prisma.SocialPublicationUpdateInput>({ attempts: { increment: 1 } })
    });
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
    // UPLOADING/CANCELLED included at runtime so the panel's counters are complete the moment the
    // migration lands; they are not yet in the generated enum, hence the single cast.
    const result = pendingSchema<Record<SocialPublicationStatus, number>>({
      PENDING: 0,
      SCHEDULED: 0,
      UPLOADING: 0,
      PUBLISHING: 0,
      PUBLISHED: 0,
      FAILED: 0,
      CANCELLED: 0
    });
    for (const row of rows) result[row.status] = row._count._all;
    return result;
  }
};

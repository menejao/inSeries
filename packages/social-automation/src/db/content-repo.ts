import { prisma } from "./client";
import type { Prisma, SocialContent, SocialContentStatus } from "@prisma/client";

export interface CreateContentInput {
  type: string;
  title: string;
  description: string;
  templateId?: string | null;
}

/** INSERIES-SOCIAL-CONTENT-ENGINE-02 — content-engine payload/source metadata, all optional so the manual generator's plain `create()` above stays untouched. */
export interface CreateContentWithPayloadInput extends CreateContentInput {
  status?: SocialContentStatus;
  format?: string | null;
  sourceSeriesId?: string | null;
  ctaId?: string | null;
  hookId?: string | null;
  payload?: Record<string, unknown> | null;
}

/** INSERIES-SOCIAL-ADMIN-PANEL-03 — filter shape the admin listing screen passes straight through from searchParams. */
export interface ListContentFilters {
  status?: SocialContentStatus | null;
  format?: string | null;
  templateId?: string | null;
  network?: string | null;
  search?: string | null;
  from?: Date | null;
  to?: Date | null;
  sortBy?: "createdAt" | "updatedAt" | "title";
  sortDir?: "asc" | "desc";
  page?: number;
  perPage?: number;
}

export type ListContentItem = Prisma.SocialContentGetPayload<{
  include: {
    template: { select: { id: true; name: true } };
    publications: { select: { id: true; network: true; status: true; scheduledFor: true } };
  };
}>;

export interface ListContentResult {
  items: ListContentItem[];
  total: number;
  page: number;
  perPage: number;
  pageCount: number;
}

function buildContentWhere(filters: ListContentFilters): Prisma.SocialContentWhereInput {
  const where: Prisma.SocialContentWhereInput = {};

  if (filters.status) where.status = filters.status;
  if (filters.format) where.format = filters.format;
  if (filters.templateId) where.templateId = filters.templateId;
  if (filters.network) where.publications = { some: { network: filters.network as Prisma.SocialPublicationWhereInput["network"] } };

  if (filters.search) {
    where.OR = [
      { title: { contains: filters.search, mode: "insensitive" } },
      { description: { contains: filters.search, mode: "insensitive" } }
    ];
  }

  if (filters.from || filters.to) {
    where.createdAt = {
      ...(filters.from ? { gte: filters.from } : {}),
      ...(filters.to ? { lte: filters.to } : {})
    };
  }

  return where;
}

export const contentRepo = {
  create(input: CreateContentInput): Promise<SocialContent> {
    return prisma.socialContent.create({
      data: {
        type: input.type,
        title: input.title,
        description: input.description,
        templateId: input.templateId ?? null,
        status: "DRAFT"
      }
    });
  },

  createWithPayload(input: CreateContentWithPayloadInput): Promise<SocialContent> {
    return prisma.socialContent.create({
      data: {
        type: input.type,
        title: input.title,
        description: input.description,
        templateId: input.templateId ?? null,
        status: input.status ?? "DRAFT",
        format: input.format ?? null,
        sourceSeriesId: input.sourceSeriesId ?? null,
        ctaId: input.ctaId ?? null,
        hookId: input.hookId ?? null,
        payload: (input.payload ?? undefined) as Prisma.InputJsonValue | undefined
      }
    });
  },

  findById(id: string): Promise<SocialContent | null> {
    return prisma.socialContent.findUnique({ where: { id } });
  },

  listByStatus(status: SocialContentStatus): Promise<SocialContent[]> {
    return prisma.socialContent.findMany({ where: { status }, orderBy: { createdAt: "asc" } });
  },

  updateStatus(id: string, status: SocialContentStatus): Promise<SocialContent> {
    return prisma.socialContent.update({ where: { id }, data: { status } });
  },

  // -------------------------------------------------------------------------
  // INSERIES-SOCIAL-ADMIN-PANEL-03 — data-layer additions for the admin panel.
  // Plain findMany/count/update calls: no editorial rule lives here.
  // -------------------------------------------------------------------------

  updateEditableFields(
    id: string,
    data: { title: string; description: string; payload: Record<string, unknown> | null }
  ): Promise<SocialContent> {
    return prisma.socialContent.update({
      where: { id },
      data: {
        title: data.title,
        description: data.description,
        payload: (data.payload ?? undefined) as Prisma.InputJsonValue | undefined
      }
    });
  },

  findByIdWithRelations(id: string) {
    return prisma.socialContent.findUnique({
      where: { id },
      include: {
        template: true,
        publications: { orderBy: { scheduledFor: "asc" } },
        history: { orderBy: { createdAt: "asc" } }
      }
    });
  },

  async listPaginated(filters: ListContentFilters): Promise<ListContentResult> {
    const where = buildContentWhere(filters);
    const page = Math.max(1, filters.page ?? 1);
    const perPage = Math.min(100, Math.max(1, filters.perPage ?? 20));

    const [items, total] = await Promise.all([
      prisma.socialContent.findMany({
        where,
        orderBy: { [filters.sortBy ?? "createdAt"]: filters.sortDir ?? "desc" },
        skip: (page - 1) * perPage,
        take: perPage,
        include: { template: { select: { id: true, name: true } }, publications: { select: { id: true, network: true, status: true, scheduledFor: true } } }
      }),
      prisma.socialContent.count({ where })
    ]);

    return { items, total, page, perPage, pageCount: Math.max(1, Math.ceil(total / perPage)) };
  },

  /** Row counts grouped by status — powers the overview counters. */
  async countsByStatus(): Promise<Record<SocialContentStatus, number>> {
    const rows = await prisma.socialContent.groupBy({ by: ["status"], _count: { _all: true } });
    const result = {
      DRAFT: 0,
      PENDING_APPROVAL: 0,
      APPROVED: 0,
      REJECTED: 0,
      PUBLISHED: 0,
      FAILED: 0,
      ARCHIVED: 0
    } as Record<SocialContentStatus, number>;
    for (const row of rows) result[row.status] = row._count._all;
    return result;
  },

  /** Distinct non-null `format` values present in the table — populates the filter dropdown from real data. */
  async listDistinctFormats(): Promise<string[]> {
    const rows = await prisma.socialContent.findMany({
      where: { format: { not: null } },
      distinct: ["format"],
      select: { format: true },
      orderBy: { format: "asc" }
    });
    return rows.map((row) => row.format).filter((format): format is string => Boolean(format));
  }
};

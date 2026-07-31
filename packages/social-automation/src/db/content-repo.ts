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
  }
};

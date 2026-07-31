import { prisma } from "./client";
import type { SocialContent, SocialContentStatus } from "@prisma/client";

export interface CreateContentInput {
  type: string;
  title: string;
  description: string;
  templateId?: string | null;
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

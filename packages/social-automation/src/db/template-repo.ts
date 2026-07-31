import { prisma } from "./client";
import type { SocialTemplate } from "@prisma/client";

export const templateRepo = {
  create(input: { name: string; type: string; active?: boolean }): Promise<SocialTemplate> {
    return prisma.socialTemplate.create({
      data: { name: input.name, type: input.type, active: input.active ?? true }
    });
  },

  findById(id: string): Promise<SocialTemplate | null> {
    return prisma.socialTemplate.findUnique({ where: { id } });
  },

  listActive(): Promise<SocialTemplate[]> {
    return prisma.socialTemplate.findMany({ where: { active: true }, orderBy: { createdAt: "asc" } });
  }
};

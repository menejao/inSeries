import { prisma } from "./client";
import type { SocialTemplate } from "@prisma/client";

/** INSERIES-SOCIAL-ADMIN-PANEL-03 — a template plus the two aggregates the admin listing shows. */
export interface TemplateWithUsage extends SocialTemplate {
  contentCount: number;
  /** MAX(SocialContent.createdAt) for this templateId — null when never used. */
  lastUsedAt: Date | null;
}

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
  },

  // ---------------------------------------------------------------------------
  // INSERIES-SOCIAL-ADMIN-PANEL-03 — data-layer additions for the admin panel.
  // ---------------------------------------------------------------------------

  listAll(): Promise<SocialTemplate[]> {
    return prisma.socialTemplate.findMany({ orderBy: { createdAt: "desc" } });
  },

  /** All templates + usage aggregates, in two queries (list + one groupBy) rather than N+1. */
  async listAllWithUsage(): Promise<TemplateWithUsage[]> {
    const templates = await prisma.socialTemplate.findMany({ orderBy: { createdAt: "desc" } });
    if (templates.length === 0) return [];

    const usage = await prisma.socialContent.groupBy({
      by: ["templateId"],
      where: { templateId: { in: templates.map((template) => template.id) } },
      _count: { _all: true },
      _max: { createdAt: true }
    });

    const byTemplateId = new Map(usage.map((row) => [row.templateId, row]));

    return templates.map((template) => {
      const row = byTemplateId.get(template.id);
      return { ...template, contentCount: row?._count._all ?? 0, lastUsedAt: row?._max.createdAt ?? null };
    });
  },

  setActive(id: string, active: boolean): Promise<SocialTemplate> {
    return prisma.socialTemplate.update({ where: { id }, data: { active } });
  }
};

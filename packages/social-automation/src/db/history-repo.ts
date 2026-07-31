import { prisma } from "./client";
import type { Prisma, SocialAutomationAction, SocialAutomationHistory } from "@prisma/client";

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
  }
};

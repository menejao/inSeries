import { prisma } from "./client";
import type { SocialPublication, SocialPublicationStatus, SocialNetwork } from "@prisma/client";

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
  }
};

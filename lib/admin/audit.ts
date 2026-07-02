import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";

export async function recordAdminAudit(input: {
  adminUserId: string;
  action: string;
  entity: string;
  entityId?: string | null;
  metadata?: Prisma.InputJsonValue | null;
  result?: "SUCCESS" | "FAILURE" | "REJECTED";
}) {
  return prisma.adminAuditLog.create({
    data: {
      adminUserId: input.adminUserId,
      action: input.action,
      entity: input.entity,
      entityId: input.entityId ?? null,
      metadata: input.metadata ?? undefined,
      result: input.result ?? "SUCCESS"
    }
  });
}

export async function getRecentAuditLogs(limit = 50) {
  return prisma.adminAuditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      adminUser: { select: { id: true, name: true, username: true } }
    }
  });
}

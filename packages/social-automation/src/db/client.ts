import { PrismaClient } from "@prisma/client";

/**
 * This package cannot import lib/db/prisma.ts (that would pull in app/ config
 * plumbing and violate the "no app/ imports" rule), so it keeps its own
 * singleton against the same generated client / same DATABASE_URL / same
 * schema. Safe to do — PrismaClient is designed to have multiple instances
 * against one database.
 */
declare global {
  // eslint-disable-next-line no-var
  var __inSeriesSocialAutomationPrisma: PrismaClient | undefined;
}

export const prisma = globalThis.__inSeriesSocialAutomationPrisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalThis.__inSeriesSocialAutomationPrisma = prisma;
}

export async function canUseDatabase(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}

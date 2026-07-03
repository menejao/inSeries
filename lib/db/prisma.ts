import { PrismaClient } from "@prisma/client";
import { config } from "@/lib/config";

declare global {
  var __inSeriesPrisma: PrismaClient | undefined;
}

export const prisma =
  globalThis.__inSeriesPrisma ??
  new PrismaClient({
    log: config.app.isProduction ? ["error"] : ["warn", "error"]
  });

if (!config.app.isProduction) {
  globalThis.__inSeriesPrisma = prisma;
}

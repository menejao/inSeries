import { PrismaClient } from "@prisma/client";

declare global {
  var __inSeriesPrisma: PrismaClient | undefined;
}

export const prisma =
  globalThis.__inSeriesPrisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"]
  });

if (process.env.NODE_ENV !== "production") {
  globalThis.__inSeriesPrisma = prisma;
}

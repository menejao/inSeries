import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";

/**
 * Read/seed-only this sprint (Fase 10): the SystemSetting table exists and can
 * be listed/read, but there is no admin UI to edit values yet — that's future
 * work once the admin workspace grows an editing flow for it.
 */
export async function listSystemSettings() {
  return prisma.systemSetting.findMany({ orderBy: { key: "asc" } });
}

export async function listPublicSystemSettings() {
  return prisma.systemSetting.findMany({ where: { public: true }, orderBy: { key: "asc" } });
}

export async function getSystemSetting(key: string) {
  return prisma.systemSetting.findUnique({ where: { key } });
}

export async function seedInitialSystemSettings() {
  const defaults: { key: string; value: Prisma.InputJsonValue; description: string; public: boolean }[] = [
    {
      key: "app.maintenance_mode",
      value: false,
      description: "Quando true, a plataforma esta em manutencao (ainda nao lido por nenhuma rota).",
      public: true
    },
    {
      key: "app.announcement",
      value: "",
      description: "Aviso opcional exibido para todos os usuarios (preparado, sem UI de leitura ainda).",
      public: true
    },
    {
      key: "catalog.max_popular_sync_pages",
      value: 5,
      description: "Limite de paginas por execucao de sincronizacao de series populares.",
      public: false
    }
  ];

  for (const setting of defaults) {
    await prisma.systemSetting.upsert({
      where: { key: setting.key },
      update: {},
      create: setting
    });
  }
}

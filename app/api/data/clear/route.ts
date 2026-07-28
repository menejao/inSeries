import { NextResponse } from "next/server";
import { z } from "zod";
import { getApiUser } from "@/lib/auth/server";
import { prisma } from "@/lib/db/prisma";
import { withApiObservability } from "@/lib/http/api-handler";

/**
 * Fase 35 — limpeza destrutiva por categoria, sempre com frase de confirmacao exata
 * ("LIMPAR") validada no servidor. Cada categoria apaga SO a categoria: nada de cascata
 * alem das relacoes obvias (apagar lista apaga os itens dela via onDelete: Cascade).
 */
const payloadSchema = z.object({
  category: z.enum(["history", "ratings", "lists", "reviews", "statuses"]),
  confirmation: z.literal("LIMPAR")
});

async function postHandler(request: Request) {
  const user = await getApiUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const payload = payloadSchema.safeParse(body);
  if (!payload.success) return NextResponse.json({ error: "confirmation_required" }, { status: 400 });

  let removed = 0;
  switch (payload.data.category) {
    case "history": {
      const result = await prisma.userEpisodeProgress.deleteMany({ where: { userId: user.id } });
      // Progresso zerado: recalcula os percentuais dos status pra 0 sem apagar os status.
      await prisma.userSeriesStatus.updateMany({ where: { userId: user.id }, data: { completionPercent: 0, completedAt: null } });
      removed = result.count;
      break;
    }
    case "ratings": {
      const result = await prisma.rating.deleteMany({ where: { userId: user.id } });
      removed = result.count;
      break;
    }
    case "lists": {
      const result = await prisma.list.deleteMany({ where: { userId: user.id } });
      removed = result.count;
      break;
    }
    case "reviews": {
      const result = await prisma.review.deleteMany({ where: { userId: user.id } });
      removed = result.count;
      break;
    }
    case "statuses": {
      const result = await prisma.userSeriesStatus.deleteMany({ where: { userId: user.id } });
      removed = result.count;
      break;
    }
  }

  return NextResponse.json({ data: { category: payload.data.category, removed } });
}

export const POST = withApiObservability("data.clear", postHandler);

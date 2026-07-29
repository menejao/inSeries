import { NextResponse } from "next/server";
import { z } from "zod";
import { getApiUser } from "@/lib/auth/server";
import { prisma } from "@/lib/db/prisma";
import { withApiObservability } from "@/lib/http/api-handler";
import { invalidateRecommendationCache } from "@/lib/recommendations";

const feedbackSchema = z.object({
  seriesId: z.string().min(1),
  action: z.enum(["LIKE", "NOT_INTERESTED", "ALREADY_WATCHED", "HIDDEN"])
});

/**
 * INSERIES-RECOMMENDATION-ENGINE-02 — "esse feedback deve alimentar futuras recomendacoes".
 * One row per user+series (upsert: a later action replaces the earlier one), read back by
 * lib/recommendations/engine.ts to exclude NOT_INTERESTED/ALREADY_WATCHED/HIDDEN outright and
 * to suppress the genres of a NOT_INTERESTED series (same rule as an abandoned series).
 */
async function feedbackHandler(request: Request) {
  const user = await getApiUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const payload = feedbackSchema.safeParse(body);
  if (!payload.success) {
    return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
  }

  const { seriesId, action } = payload.data;
  await prisma.recommendationFeedback.upsert({
    where: { userId_seriesId: { userId: user.id, seriesId } },
    create: { userId: user.id, seriesId, action },
    update: { action }
  });

  invalidateRecommendationCache(user.id);
  return NextResponse.json({ data: { ok: true } });
}

export const POST = withApiObservability("recommendations.feedback", feedbackHandler);

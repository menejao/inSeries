import { NextResponse } from "next/server";
import { getApiUser } from "@/lib/auth/server";
import { getRecommendationsForUser } from "@/lib/recommendations";
import { withApiObservability } from "@/lib/http/api-handler";

/**
 * Structured recommendations for the current user — series, score, reason
 * and originating provider for each item (see lib/recommendations). Same
 * object the `/me` "Recomendado para voce" section renders.
 */
async function recommendationsHandler(request: Request) {
  const user = await getApiUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const limitParam = Number(searchParams.get("limit"));
  const limit = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(50, Math.trunc(limitParam)) : undefined;

  const result = await getRecommendationsForUser(user.id, { limit });
  return NextResponse.json({ data: result });
}

export const GET = withApiObservability("recommendations", recommendationsHandler);

import { NextResponse } from "next/server";
import { getApiUser } from "@/lib/auth/server";
import { prisma } from "@/lib/db/prisma";
import { markSeasonWatched } from "@/lib/progress/mutations";
import { withApiObservability } from "@/lib/http/api-handler";

/**
 * INSERIES-SERIES-STATUS-ENGINE-01 — "marcar temporada como assistida": one request marks
 * every available episode of the season and recalculates progress/status once, replacing the
 * old client-side loop of one `POST /api/episodes/[id]/progress` per episode
 * (`SeasonSelector.markWholeSeasonWatched`), which recomputed `UserSeriesStatus` N times.
 */
async function watchSeasonHandler(request: Request, { params }: { params: Promise<{ id: string; number: string }> }) {
  const user = await getApiUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id, number } = await params;
  const seasonNumber = Number(number);
  if (!Number.isFinite(seasonNumber)) {
    return NextResponse.json({ error: "invalid_season" }, { status: 400 });
  }

  const season = await prisma.season.findUnique({ where: { seriesId_number: { seriesId: id, number: seasonNumber } }, select: { id: true } });
  if (!season) return NextResponse.json({ error: "season_not_found" }, { status: 404 });

  const result = await markSeasonWatched(user.id, season.id);
  if (!result) return NextResponse.json({ error: "season_not_found" }, { status: 404 });

  return NextResponse.json({ data: result });
}

export const POST = withApiObservability("series.season.watch", watchSeasonHandler);

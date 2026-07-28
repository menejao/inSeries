import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { canUseDatabase } from "@/lib/db/health";
import { getApiUser } from "@/lib/auth/server";
import { withApiObservability } from "@/lib/http/api-handler";

const LIMIT = 10;

import type { ActivityType } from "@prisma/client";

const JOURNEY_TYPES: ActivityType[] = ["EPISODE_WATCHED", "SERIES_STATUS_CHANGED", "SERIES_COMPLETED", "REVIEW_CREATED"];

async function journeyHandler(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getApiUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  if (!(await canUseDatabase())) {
    return NextResponse.json({ error: "database_unavailable" }, { status: 503 });
  }

  const { id: seriesId } = await params;
  const { searchParams } = new URL(request.url);
  const cursor = searchParams.get("cursor");

  const items = await prisma.activity.findMany({
    where: {
      userId: user.id,
      seriesId,
      type: { in: JOURNEY_TYPES },
      ...(cursor ? { createdAt: { lt: new Date(cursor) } } : {})
    },
    select: {
      id: true,
      type: true,
      createdAt: true,
      metadata: true,
      episode: {
        select: {
          number: true,
          title: true,
          season: { select: { number: true } }
        }
      },
      review: { select: { rating: true } }
    },
    orderBy: { createdAt: "desc" },
    take: LIMIT + 1
  });

  const hasMore = items.length > LIMIT;
  const pageItems = hasMore ? items.slice(0, LIMIT) : items;
  const nextCursor = hasMore ? pageItems[pageItems.length - 1].createdAt.toISOString() : null;

  return NextResponse.json({
    items: pageItems.map((item) => ({ ...item, createdAt: item.createdAt.toISOString() })),
    nextCursor
  });
}

export const GET = withApiObservability("series.journey", journeyHandler);

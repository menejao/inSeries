import { NextResponse } from "next/server";
import { getApiUser } from "@/lib/auth/server";
import { prisma } from "@/lib/db/prisma";
import { withApiObservability } from "@/lib/http/api-handler";

async function toggleFavoriteHandler(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getApiUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id: seriesId } = await params;

  const existing = await prisma.userSeriesStatus.findUnique({
    where: { userId_seriesId: { userId: user.id, seriesId } },
    select: { isFavorite: true }
  });

  const nextFavorite = !existing?.isFavorite;

  await prisma.userSeriesStatus.upsert({
    where: { userId_seriesId: { userId: user.id, seriesId } },
    update: { isFavorite: nextFavorite },
    create: { userId: user.id, seriesId, state: "WANT_TO_WATCH", isFavorite: nextFavorite }
  });

  return NextResponse.json({ data: { isFavorite: nextFavorite } });
}

export const POST = withApiObservability("series.favorite", toggleFavoriteHandler);

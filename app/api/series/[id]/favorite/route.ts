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

  if (!existing) {
    return NextResponse.json({ error: "not_in_library" }, { status: 404 });
  }

  const updated = await prisma.userSeriesStatus.update({
    where: { userId_seriesId: { userId: user.id, seriesId } },
    data: { isFavorite: !existing.isFavorite },
    select: { isFavorite: true }
  });

  return NextResponse.json({ data: { isFavorite: updated.isFavorite } });
}

export const POST = withApiObservability("series.favorite", toggleFavoriteHandler);

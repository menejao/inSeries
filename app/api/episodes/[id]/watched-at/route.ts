import { NextResponse } from "next/server";
import { z } from "zod";
import { getApiUser } from "@/lib/auth/server";
import { prisma } from "@/lib/db/prisma";
import { withApiObservability } from "@/lib/http/api-handler";

const schema = z.object({ watchedAt: z.string().datetime() });

async function updateWatchedAtHandler(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getApiUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id: episodeId } = await params;
  const body = await request.json();
  const payload = schema.safeParse(body);
  if (!payload.success) return NextResponse.json({ error: "invalid_payload" }, { status: 400 });

  const existing = await prisma.userEpisodeProgress.findUnique({
    where: { userId_episodeId: { userId: user.id, episodeId } },
    select: { watched: true }
  });
  if (!existing?.watched) return NextResponse.json({ error: "not_watched" }, { status: 404 });

  const updated = await prisma.userEpisodeProgress.update({
    where: { userId_episodeId: { userId: user.id, episodeId } },
    data: { watchedAt: new Date(payload.data.watchedAt) },
    select: { watchedAt: true }
  });

  return NextResponse.json({ data: { watchedAt: updated.watchedAt?.toISOString() ?? null } });
}

export const PATCH = withApiObservability("episodes.watched-at", updateWatchedAtHandler);

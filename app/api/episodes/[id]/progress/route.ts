import { NextResponse } from "next/server";
import { z } from "zod";
import { getApiUser } from "@/lib/auth/server";
import { toggleEpisodeProgress } from "@/lib/progress/mutations";
import { withApiObservability } from "@/lib/http/api-handler";

const progressSchema = z.object({
  episodeId: z.string().min(1),
  watched: z.boolean(),
  // INSERIES-SERIES-LIBRARY-ENGINE-01 — "escolher a data que assisti esse episodio em
  // especifico": "YYYY-MM-DD", opcional, ignorado quando watched === false. Nunca no futuro.
  watchedAt: z
    .string()
    .refine((value) => !Number.isNaN(Date.parse(value)), "invalid_date")
    .refine((value) => new Date(value).getTime() <= Date.now(), "future_date")
    .optional()
});

async function progressHandler(request: Request) {
  const user = await getApiUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const payload = progressSchema.safeParse(body);

  if (!payload.success) {
    return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
  }

  const watchedAt = payload.data.watchedAt ? new Date(payload.data.watchedAt) : undefined;
  const progress = await toggleEpisodeProgress(user.id, payload.data.episodeId, payload.data.watched, watchedAt);
  if (!progress) {
    return NextResponse.json({ error: "episode_not_found" }, { status: 404 });
  }
  if ("error" in progress) {
    return NextResponse.json({ error: progress.error }, { status: 400 });
  }

  return NextResponse.json({ data: progress });
}

export const POST = withApiObservability("episodes.progress", progressHandler);

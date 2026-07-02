import { NextResponse } from "next/server";
import { z } from "zod";
import { getApiUser } from "@/lib/auth/server";
import { toggleEpisodeProgress } from "@/lib/progress/mutations";

const progressSchema = z.object({
  episodeId: z.string().min(1),
  watched: z.boolean()
});

export async function POST(request: Request) {
  const user = await getApiUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const payload = progressSchema.safeParse(body);

  if (!payload.success) {
    return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
  }

  const progress = await toggleEpisodeProgress(user.id, payload.data.episodeId, payload.data.watched);
  if (!progress) {
    return NextResponse.json({ error: "episode_not_found" }, { status: 404 });
  }

  return NextResponse.json({ data: progress });
}

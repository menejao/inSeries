import { NextResponse } from "next/server";
import { z } from "zod";
import { getApiUser } from "@/lib/auth/server";
import { upsertSeriesStatus } from "@/lib/progress/mutations";

const statusSchema = z.object({
  seriesId: z.string().min(1),
  state: z.enum(["WATCHING", "COMPLETED", "PAUSED", "DROPPED", "WANT_TO_WATCH"])
});

export async function POST(request: Request) {
  const user = await getApiUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const payload = statusSchema.safeParse(body);

  if (!payload.success) {
    return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
  }

  const status = await upsertSeriesStatus(user.id, payload.data.seriesId, payload.data.state);
  return NextResponse.json({ data: status });
}

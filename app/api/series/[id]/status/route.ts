import { NextResponse } from "next/server";
import { z } from "zod";
import { getApiUser } from "@/lib/auth/server";
import { removeSeriesStatus, upsertSeriesStatus } from "@/lib/progress/mutations";
import { withApiObservability } from "@/lib/http/api-handler";

const statusSchema = z.object({
  seriesId: z.string().min(1),
  state: z.enum(["WATCHING", "COMPLETED", "PAUSED", "DROPPED", "WANT_TO_WATCH"]),
  // INSERIES-SERIES-LIBRARY-ENGINE-01 — "Quando voce terminou esta serie?": data (YYYY-MM-DD)
  // opcional aplicada ao completedAt/watchedAt quando state === "COMPLETED". Nunca no futuro.
  completedAt: z
    .string()
    .refine((value) => !Number.isNaN(Date.parse(value)), "invalid_date")
    .refine((value) => new Date(value).getTime() <= Date.now(), "future_date")
    .optional()
});

async function statusHandler(request: Request) {
  const user = await getApiUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const payload = statusSchema.safeParse(body);

  if (!payload.success) {
    return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
  }

  const completedAt = payload.data.completedAt ? new Date(payload.data.completedAt) : undefined;
  const status = await upsertSeriesStatus(user.id, payload.data.seriesId, payload.data.state, completedAt);
  return NextResponse.json({ data: status });
}

async function deleteHandler(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getApiUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  await removeSeriesStatus(user.id, id);
  return NextResponse.json({ data: { ok: true } });
}

export const POST = withApiObservability("series.status", statusHandler);
export const DELETE = withApiObservability("series.status.delete", deleteHandler);

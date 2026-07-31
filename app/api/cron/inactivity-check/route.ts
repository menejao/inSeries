import { NextResponse } from "next/server";
import { pauseInactiveSeriesForAllUsers } from "@/lib/progress/inactivity";
import { withApiObservability } from "@/lib/http/api-handler";

/**
 * INSERIES-SERIES-STATUS-ENGINE-01 — daily job, same auth pattern as
 * app/api/cron/catalog-sync/route.ts (Vercel Cron, `Authorization: Bearer <CRON_SECRET>`).
 * Pauses series inactive past each user's configured threshold — never marks anything
 * Abandonada, never touches Concluida (see lib/progress/inactivity.ts).
 */
async function cronHandler(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  const result = await pauseInactiveSeriesForAllUsers();
  return NextResponse.json({ ok: true, pausedCount: result.pausedCount });
}

export const GET = withApiObservability("cron.inactivity-check", cronHandler);
export const maxDuration = 60;

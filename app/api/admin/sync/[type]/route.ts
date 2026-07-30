import { NextResponse } from "next/server";
import { getAdminApiUser } from "@/lib/admin/rbac";
import { recordAdminAudit } from "@/lib/admin/audit";
import { syncExistingSeriesDetails, syncPopularSeries } from "@/lib/catalog/sync";
import { runDiscoveryEngine } from "@/lib/discovery/engine";
import { withApiObservability } from "@/lib/http/api-handler";
import { checkRateLimit, getClientIdentifier } from "@/lib/rate-limit";
import { prisma } from "@/lib/db/prisma";

const BATCH_SIZE = 25;

const SYNC_HANDLERS = {
  popular: () => syncPopularSeries({ pages: 1 }),
  existing: () => syncExistingSeriesDetails(),
  // Fase 7/11 (INSERIES-TRENDING-DISCOVERY-ENGINE-01) — lets an admin trigger the Discovery
  // Engine on demand (or via an external cron hitting this same route), without touching
  // the two handlers above.
  discovery: () => runDiscoveryEngine(),
  // Repair: re-fetches full TMDB details only for series with posterUrl = null, in batches
  // of BATCH_SIZE so the Vercel function stays within the 60s timeout. Call repeatedly
  // until remaining === 0.
  "repair-posters": async () => {
    const nullPosterSeries = await prisma.series.findMany({
      where: { posterUrl: null },
      select: { id: true },
      take: BATCH_SIZE
    });
    const remaining = await prisma.series.count({ where: { posterUrl: null } });
    if (nullPosterSeries.length === 0) {
      return { ok: true, processed: 0, remaining: 0 };
    }
    const summary = await syncExistingSeriesDetails(nullPosterSeries.map((s) => s.id));
    return { ...summary, processed: nullPosterSeries.length, remaining: Math.max(0, remaining - nullPosterSeries.length) };
  }
} as const;

type SyncTypeParam = keyof typeof SYNC_HANDLERS;

function isValidType(value: string): value is SyncTypeParam {
  return value in SYNC_HANDLERS;
}

async function triggerHandler(request: Request, { params }: { params: Promise<{ type: string }> }) {
  const admin = await getAdminApiUser("admin.sync");
  if (!admin) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const rateLimit = checkRateLimit("sync", getClientIdentifier(request));
  if (!rateLimit.allowed) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const { type } = await params;
  if (!isValidType(type)) {
    return NextResponse.json({ error: "invalid_sync_type" }, { status: 400 });
  }

  const summary = await SYNC_HANDLERS[type]();

  await recordAdminAudit({
    adminUserId: admin.id,
    action: "START_SYNC",
    entity: "CatalogSyncRun",
    entityId: "runId" in summary ? summary.runId : type,
    metadata: { type, ...("status" in summary ? { status: summary.status } : {}) },
    result: "status" in summary ? (summary.status === "FAILED" ? "FAILURE" : summary.status === "RUNNING" ? "REJECTED" : "SUCCESS") : "SUCCESS"
  });

  return NextResponse.json({ ok: true, summary });
}

export const POST = withApiObservability("admin.sync.trigger", triggerHandler);

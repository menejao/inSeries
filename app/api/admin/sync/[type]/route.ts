import { NextResponse } from "next/server";
import { getAdminApiUser } from "@/lib/admin/rbac";
import { recordAdminAudit } from "@/lib/admin/audit";
import { syncExistingSeriesDetails, syncPopularSeries } from "@/lib/catalog/sync";

const SYNC_HANDLERS = {
  popular: () => syncPopularSeries({ pages: 1 }),
  existing: () => syncExistingSeriesDetails()
} as const;

type SyncTypeParam = keyof typeof SYNC_HANDLERS;

function isValidType(value: string): value is SyncTypeParam {
  return value in SYNC_HANDLERS;
}

export async function POST(request: Request, { params }: { params: Promise<{ type: string }> }) {
  const admin = await getAdminApiUser("admin.sync");
  if (!admin) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
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
    entityId: summary.runId,
    metadata: { type, status: summary.status },
    result: summary.status === "FAILED" ? "FAILURE" : summary.status === "RUNNING" ? "REJECTED" : "SUCCESS"
  });

  return NextResponse.json({ ok: true, summary });
}

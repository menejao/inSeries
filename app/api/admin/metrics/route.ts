import { NextResponse } from "next/server";
import { getAdminApiUser } from "@/lib/admin/rbac";
import { getMetricsSnapshot } from "@/lib/metrics/service";
import { withApiObservability } from "@/lib/http/api-handler";

/**
 * Read-only JSON snapshot of the in-memory metrics (see lib/metrics/service.ts).
 * Intended for the admin "Sistema" page and, eventually, a Prometheus/OpenTelemetry
 * scrape target — this endpoint is the seam where that would plug in.
 */
async function metricsHandler() {
  const admin = await getAdminApiUser("admin.system");
  if (!admin) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  return NextResponse.json({ data: getMetricsSnapshot() });
}

export const GET = withApiObservability("admin.metrics", metricsHandler);

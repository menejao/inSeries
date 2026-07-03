import { NextResponse } from "next/server";
import { getReadySnapshot } from "@/lib/health/service";
import { withApiObservability } from "@/lib/http/api-handler";

/** Readiness probe: validates the critical dependencies the app cannot serve traffic without. */
async function handler() {
  const snapshot = await getReadySnapshot();
  return NextResponse.json(snapshot, { status: snapshot.ready ? 200 : 503 });
}

export const GET = withApiObservability("ready", handler);

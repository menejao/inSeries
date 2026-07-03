import { NextResponse } from "next/server";
import { getHealthSnapshot } from "@/lib/health/service";
import { withApiObservability } from "@/lib/http/api-handler";

/** Liveness probe: always fast, never touches the database. */
async function handler() {
  return NextResponse.json(getHealthSnapshot());
}

export const GET = withApiObservability("health", handler);

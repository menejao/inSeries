import { NextResponse } from "next/server";
import { getApiUser } from "@/lib/auth/server";
import { listAvailableRecaps } from "@/lib/recap";
import { withApiObservability } from "@/lib/http/api-handler";

/** Lists which years/months the current user has a recap for — no per-period computation, see service.ts. */
async function recapAvailabilityHandler() {
  const user = await getApiUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const result = await listAvailableRecaps(user.id);
  if (!result.enabled) {
    return NextResponse.json({ error: "feature_disabled" }, { status: 404 });
  }

  return NextResponse.json({ data: result.availability });
}

export const GET = withApiObservability("me.recap.availability", recapAvailabilityHandler);

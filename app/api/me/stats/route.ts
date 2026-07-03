import { NextResponse } from "next/server";
import { getApiUser } from "@/lib/auth/server";
import { getUserStats } from "@/lib/analytics";
import { withApiObservability } from "@/lib/http/api-handler";

/**
 * Structured stats for the current user — the same object the `/me/stats`
 * dashboard renders. Exists as its own endpoint (rather than only a server
 * component data fetch) so a future export/recap feature (PDF, shareable
 * image) can consume the exact same numbers without duplicating any
 * calculation logic.
 */
async function statsHandler() {
  const user = await getApiUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const stats = await getUserStats(user.id);
  return NextResponse.json({ data: stats });
}

export const GET = withApiObservability("me.stats", statsHandler);

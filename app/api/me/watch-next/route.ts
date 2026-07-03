import { NextResponse } from "next/server";
import { getApiUser } from "@/lib/auth/server";
import { getWatchNextForUser } from "@/lib/watch-next";
import { withApiObservability } from "@/lib/http/api-handler";

/** Same object the `/watch-next` page and the `/me` dashboard section render. */
async function watchNextHandler(request: Request) {
  const user = await getApiUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const limitParam = Number(searchParams.get("limit"));
  const limit = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(50, Math.trunc(limitParam)) : undefined;

  const result = await getWatchNextForUser(user.id, { limit });
  return NextResponse.json({ data: result });
}

export const GET = withApiObservability("me.watch-next", watchNextHandler);

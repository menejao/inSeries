import { NextResponse } from "next/server";
import { z } from "zod";
import { getApiUser } from "@/lib/auth/server";
import { withApiObservability } from "@/lib/http/api-handler";
import { getGlobalFeed, getPersonalFeed, getFollowingFeed } from "@/lib/social/activity";

const querySchema = z.object({
  view: z.enum(["personal", "following", "global"]).default("personal"),
  cursor: z.string().optional()
});

const FEED_PAGE_SIZE = 20;

/** INSERIES-FEED-REDESIGN-01 — real cursor pagination behind "Carregar mais": only fetches the next `FEED_PAGE_SIZE` activities, never the whole timeline. */
async function getHandler(request: Request) {
  const user = await getApiUser();
  const { searchParams } = new URL(request.url);
  const payload = querySchema.safeParse({
    view: searchParams.get("view") ?? undefined,
    cursor: searchParams.get("cursor") ?? undefined
  });
  if (!payload.success) return NextResponse.json({ error: "invalid_query" }, { status: 400 });

  const { view, cursor } = payload.data;

  if (view === "global") {
    const page = await getGlobalFeed(user?.id ?? null, FEED_PAGE_SIZE, cursor);
    return NextResponse.json({ data: page });
  }

  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const page = view === "following" ? await getFollowingFeed(user.id, FEED_PAGE_SIZE, cursor) : await getPersonalFeed(user.id, FEED_PAGE_SIZE, cursor);
  return NextResponse.json({ data: page });
}

export const GET = withApiObservability("feed.list", getHandler);

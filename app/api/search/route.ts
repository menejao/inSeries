import { NextResponse } from "next/server";
import { searchProvider } from "@/lib/discovery/provider";
import { searchPublicLists, searchPublicReviews, searchUsers } from "@/lib/discovery/search";
import { withApiObservability } from "@/lib/http/api-handler";
import { checkRateLimit, getClientIdentifier } from "@/lib/rate-limit";

const VALID_TYPES = ["series", "users", "lists", "reviews", "all"] as const;
type SearchType = (typeof VALID_TYPES)[number];

async function searchHandler(request: Request) {
  const rateLimit = checkRateLimit("search", getClientIdentifier(request));
  if (!rateLimit.allowed) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim() || undefined;
  const typeParam = searchParams.get("type") ?? "series";
  const type: SearchType = (VALID_TYPES as readonly string[]).includes(typeParam) ? (typeParam as SearchType) : "series";
  const limit = Math.min(50, Math.max(1, Number(searchParams.get("limit")) || 10));

  const data: {
    series?: Awaited<ReturnType<typeof searchProvider.searchSeries>>["items"];
    users?: Awaited<ReturnType<typeof searchUsers>>;
    lists?: Awaited<ReturnType<typeof searchPublicLists>>;
    reviews?: Awaited<ReturnType<typeof searchPublicReviews>>;
  } = {};

  if (type === "series" || type === "all") {
    const result = await searchProvider.searchSeries({ q, page: 1, pageSize: limit });
    data.series = result.items;
  }

  if (type === "users" || type === "all") {
    data.users = q ? await searchUsers(q, limit) : [];
  }

  if (type === "lists" || type === "all") {
    data.lists = q ? await searchPublicLists(q, limit) : [];
  }

  if (type === "reviews" || type === "all") {
    data.reviews = q ? await searchPublicReviews(q, limit) : [];
  }

  return NextResponse.json({ data, type, q: q ?? null });
}

export const GET = withApiObservability("search", searchHandler);

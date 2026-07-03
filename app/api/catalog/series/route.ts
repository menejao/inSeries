import { NextResponse } from "next/server";
import { catalogProvider } from "@/lib/tmdb/adapter";
import { withApiObservability } from "@/lib/http/api-handler";

async function seriesHandler(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q") ?? undefined;
  const data = await catalogProvider.listSeries(query);

  return NextResponse.json({ data, source: query ? "database-search" : "database-or-fallback" });
}

export const GET = withApiObservability("catalog.series", seriesHandler);

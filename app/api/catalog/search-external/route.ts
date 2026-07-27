import { NextResponse } from "next/server";
import { searchExternalSeries } from "@/lib/catalog/repository";
import { TmdbConfigurationError } from "@/lib/tmdb/service";
import { withApiObservability } from "@/lib/http/api-handler";

/** Fase 3 (INSERIES-CATALOG-SERIES-EXPERIENCE-01) — segundo passo da busca hibrida: so chamado pelo client quando a busca local (banco) nao encontrou nada para o termo. */
async function searchExternalHandler(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q")?.trim();

  if (!query) {
    return NextResponse.json({ data: [] });
  }

  try {
    const results = await searchExternalSeries(query);
    return NextResponse.json({ data: results.slice(0, 20) });
  } catch (error) {
    if (error instanceof TmdbConfigurationError) {
      return NextResponse.json({ error: "tmdb_not_configured" }, { status: 412 });
    }
    return NextResponse.json({ error: "tmdb_search_failed" }, { status: 502 });
  }
}

export const GET = withApiObservability("catalog.search-external", searchExternalHandler);

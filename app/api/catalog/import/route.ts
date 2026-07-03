import { NextResponse } from "next/server";
import { z } from "zod";
import { importSeriesFromTmdb } from "@/lib/catalog/repository";
import { TmdbConfigurationError } from "@/lib/tmdb/service";
import { withApiObservability } from "@/lib/http/api-handler";

const payloadSchema = z.object({
  tmdbId: z.string().min(1)
});

async function importHandler(request: Request) {
  const body = await request.json();
  const parsed = payloadSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
  }

  try {
    const series = await importSeriesFromTmdb(parsed.data.tmdbId);
    return NextResponse.json({ data: series }, { status: 201 });
  } catch (error) {
    if (error instanceof TmdbConfigurationError) {
      return NextResponse.json({ error: error.message }, { status: 412 });
    }

    return NextResponse.json({ error: "catalog_import_failed" }, { status: 500 });
  }
}

export const POST = withApiObservability("catalog.import", importHandler);

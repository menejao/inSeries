import { NextResponse } from "next/server";
import { z } from "zod";
import { getApiUser } from "@/lib/auth/server";
import { prisma } from "@/lib/db/prisma";
import { detectAndParse } from "@/lib/import/adapters";
import { matchManifest } from "@/lib/import/matching";
import { withApiObservability } from "@/lib/http/api-handler";
import type { Prisma } from "@prisma/client";
import type { ImportTotals } from "@/lib/import/types";

// Fase 11/12/47 — limites: conteudo chega como texto (o cliente le o arquivo localmente e
// envia o conteudo, nunca um multipart persistido em disco — nada de arquivo temporario no
// servidor pra vazar/limpar). 15 MB de texto cobre exportacoes reais de historico com folga.
const MAX_CONTENT_LENGTH = 15 * 1024 * 1024;
const MAX_JOBS_KEPT = 20;

const payloadSchema = z.object({
  source: z.enum(["tvtime", "imdb", "letterboxd", "inseries", "csv", "auto"]),
  fileName: z.string().min(1).max(200),
  content: z.string().min(1)
});

async function postHandler(request: Request) {
  const user = await getApiUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const payload = payloadSchema.safeParse(body);
  if (!payload.success) return NextResponse.json({ error: "invalid_payload" }, { status: 400 });

  if (payload.data.content.length > MAX_CONTENT_LENGTH) {
    return NextResponse.json({ error: "file_too_large", maxBytes: MAX_CONTENT_LENGTH }, { status: 413 });
  }

  const fileName = payload.data.fileName.replace(/[^\w.\-() ]/g, "_");
  const manifest = detectAndParse(payload.data.content, fileName, payload.data.source === "auto" ? undefined : payload.data.source);

  if (manifest.errors.length && !manifest.items.length) {
    return NextResponse.json({ error: "unrecognized_format", details: manifest.errors }, { status: 422 });
  }

  const analyzed = await matchManifest(manifest);

  const totals: ImportTotals = {
    seriesCount: analyzed.series.length,
    episodeCount: analyzed.series.reduce((sum, series) => sum + series.episodes.length, 0),
    ratingCount: analyzed.series.filter((series) => series.rating !== undefined).length,
    listCount: new Set(analyzed.series.flatMap((series) => series.listNames)).size,
    confirmed: analyzed.series.filter((series) => series.confidence === "confirmed").length,
    probable: analyzed.series.filter((series) => series.confidence === "probable").length,
    ambiguous: analyzed.series.filter((series) => series.confidence === "ambiguous").length,
    notFound: analyzed.series.filter((series) => series.confidence === "not_found").length,
    ignored: analyzed.ignoredItems
  };

  const job = await prisma.importJob.create({
    data: {
      userId: user.id,
      source: analyzed.source,
      fileName,
      status: "ANALYZED",
      manifest: analyzed as unknown as Prisma.InputJsonValue,
      totals: totals as unknown as Prisma.InputJsonValue
    }
  });

  // Retencao: mantem so os N jobs mais recentes por usuario.
  const stale = await prisma.importJob.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    skip: MAX_JOBS_KEPT,
    select: { id: true }
  });
  if (stale.length) {
    await prisma.importJob.deleteMany({ where: { id: { in: stale.map((row) => row.id) } } });
  }

  return NextResponse.json({ data: { jobId: job.id, totals, warnings: analyzed.warnings, series: analyzed.series } }, { status: 201 });
}

async function getHandler() {
  const user = await getApiUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const jobs = await prisma.importJob.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      source: true,
      fileName: true,
      status: true,
      totals: true,
      processedCount: true,
      report: true,
      createdAt: true,
      updatedAt: true
    }
  });

  return NextResponse.json({ data: jobs });
}

export const POST = withApiObservability("data.import.analyze", postHandler);
export const GET = withApiObservability("data.import.list", getHandler);

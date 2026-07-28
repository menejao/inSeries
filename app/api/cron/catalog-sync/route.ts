import { NextResponse } from "next/server";
import { syncCoverage } from "@/lib/catalog/sync";
import { withApiObservability } from "@/lib/http/api-handler";

/**
 * Fase 12 (INSERIES-CATALOG-POPULATION-AND-EXPERIENCE-V3) — rotina periodica de atualizacao
 * do catalogo. Disparada pelo Vercel Cron (ver vercel.json, 1x/dia), autenticada por
 * `CRON_SECRET` (padrao do Vercel: `Authorization: Bearer <CRON_SECRET>`), nunca por sessao de
 * admin — um cron nao tem usuario logado. Reusa `syncCoverage` sem alteracao: mesma logica de
 * multi-fonte/dedupe/cadencia de atualizacao ja usada pelo sync manual (`npm run
 * sync:coverage`), so agora executando sozinha, todo dia.
 */
async function cronHandler(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  const summary = await syncCoverage();

  return NextResponse.json({
    ok: summary.status !== "FAILED",
    status: summary.status,
    uniqueCount: summary.uniqueCount,
    imported: summary.totals.importedSeriesCount,
    updated: summary.totals.updatedSeriesCount,
    runId: summary.runId
  });
}

export const GET = withApiObservability("cron.catalog-sync", cronHandler);
export const maxDuration = 300;

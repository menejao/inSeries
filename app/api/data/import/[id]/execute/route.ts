import { NextResponse } from "next/server";
import { getApiUser } from "@/lib/auth/server";
import { prisma } from "@/lib/db/prisma";
import { applySeries } from "@/lib/import/apply";
import { emptyReport, type AnalyzedManifest, type ConflictPolicy, type ImportReport } from "@/lib/import/types";
import { withApiObservability } from "@/lib/http/api-handler";
import type { Prisma } from "@prisma/client";

/**
 * Fases 27/28/29 — execucao em lotes com checkpoint: cada POST processa ate BATCH_SIZE
 * series e persiste `processedCount` + `report` parcial. O cliente re-chama ate `done`;
 * se o usuario sair da pagina, o job fica IMPORTING com checkpoint salvo e o botao
 * "Continuar" do historico retoma exatamente de onde parou — nada de transacao gigante,
 * nada de request de varios minutos (limite de function do plano Hobby).
 */
const BATCH_SIZE = 3;

async function postHandler(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getApiUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  const job = await prisma.importJob.findFirst({ where: { id, userId: user.id } });
  if (!job) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (job.status === "CANCELLED") return NextResponse.json({ error: "job_cancelled" }, { status: 409 });
  if (job.status !== "ANALYZED" && job.status !== "IMPORTING") {
    return NextResponse.json({ error: "job_already_finished" }, { status: 409 });
  }

  const manifest = job.manifest as unknown as AnalyzedManifest;
  const report: ImportReport = (job.report as unknown as ImportReport) ?? emptyReport();
  const policy = job.conflictPolicy as ConflictPolicy;

  const start = job.processedCount;
  const batch = manifest.series.slice(start, start + BATCH_SIZE);

  for (const group of batch) {
    try {
      await applySeries(user.id, group, policy, report);
    } catch (error) {
      report.failures.push({ series: group.title, error: error instanceof Error ? error.message : "unknown" });
      report.skippedSeries += 1;
    }
  }

  const processedCount = start + batch.length;
  const done = processedCount >= manifest.series.length;
  const finalStatus = done ? (report.failures.length || report.skippedSeries ? "COMPLETED_WITH_WARNINGS" : "COMPLETED") : "IMPORTING";

  await prisma.importJob.update({
    where: { id: job.id },
    data: {
      status: finalStatus,
      processedCount,
      report: report as unknown as Prisma.InputJsonValue
    }
  });

  return NextResponse.json({
    data: {
      done,
      processedCount,
      totalCount: manifest.series.length,
      status: finalStatus,
      report: done ? report : undefined
    }
  });
}

export const POST = withApiObservability("data.import.execute", postHandler);
export const maxDuration = 60;

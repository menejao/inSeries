import { NextResponse } from "next/server";
import { getApiUser } from "@/lib/auth/server";
import { prisma } from "@/lib/db/prisma";
import { undoImport } from "@/lib/import/apply";
import { withApiObservability } from "@/lib/http/api-handler";
import type { ImportReport } from "@/lib/import/types";

/** Fase 33 — remove APENAS os registros criados por esta importacao (ids gravados no report). Dados anteriores e posteriores do usuario ficam intactos. */
async function postHandler(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getApiUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  const job = await prisma.importJob.findFirst({ where: { id, userId: user.id } });
  if (!job) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (job.status !== "COMPLETED" && job.status !== "COMPLETED_WITH_WARNINGS") {
    return NextResponse.json({ error: "job_not_undoable" }, { status: 409 });
  }

  const report = job.report as unknown as ImportReport | null;
  if (!report) return NextResponse.json({ error: "no_report" }, { status: 409 });

  await undoImport(user.id, report);
  await prisma.importJob.update({ where: { id: job.id }, data: { status: "UNDONE" } });

  return NextResponse.json({
    data: {
      removedProgress: report.createdProgressIds.length,
      removedRatings: report.createdRatingIds.length,
      removedStatuses: report.createdStatusIds.length,
      removedLists: report.createdListIds.length
    }
  });
}

export const POST = withApiObservability("data.import.undo", postHandler);

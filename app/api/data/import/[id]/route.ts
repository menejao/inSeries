import { NextResponse } from "next/server";
import { z } from "zod";
import { getApiUser } from "@/lib/auth/server";
import { prisma } from "@/lib/db/prisma";
import { withApiObservability } from "@/lib/http/api-handler";
import type { Prisma } from "@prisma/client";
import type { AnalyzedManifest } from "@/lib/import/types";

async function getHandler(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getApiUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  const job = await prisma.importJob.findFirst({ where: { id, userId: user.id } });
  if (!job) return NextResponse.json({ error: "not_found" }, { status: 404 });

  return NextResponse.json({ data: job });
}

// Fase 16/20 — revisao pre-confirmacao: resolver ambiguos (escolher tmdbId ou pular) e
// definir a politica de conflito. So permitido enquanto o job ainda esta ANALYZED.
const patchSchema = z.object({
  conflictPolicy: z.enum(["keep_existing", "use_imported", "use_newest"]).optional(),
  resolutions: z
    .array(
      z.object({
        key: z.string().min(1),
        tmdbId: z.string().min(1).optional(),
        skipped: z.boolean().optional()
      })
    )
    .optional()
});

async function patchHandler(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getApiUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  const job = await prisma.importJob.findFirst({ where: { id, userId: user.id } });
  if (!job) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (job.status !== "ANALYZED") return NextResponse.json({ error: "job_not_editable" }, { status: 409 });

  const body = await request.json().catch(() => null);
  const payload = patchSchema.safeParse(body);
  if (!payload.success) return NextResponse.json({ error: "invalid_payload" }, { status: 400 });

  const manifest = job.manifest as unknown as AnalyzedManifest;
  for (const resolution of payload.data.resolutions ?? []) {
    const group = manifest.series.find((series) => series.key === resolution.key);
    if (!group) continue;
    if (resolution.skipped !== undefined) group.skipped = resolution.skipped;
    if (resolution.tmdbId) {
      group.tmdbId = resolution.tmdbId;
      group.confidence = "confirmed";
      group.skipped = false;
    }
  }

  const updated = await prisma.importJob.update({
    where: { id: job.id },
    data: {
      manifest: manifest as unknown as Prisma.InputJsonValue,
      ...(payload.data.conflictPolicy ? { conflictPolicy: payload.data.conflictPolicy } : {})
    }
  });

  return NextResponse.json({ data: updated });
}

/** Fase 30 — cancelamento: antes/apos analise cancela imediato; durante execucao, o loop do cliente para e o que ja foi aplicado permanece. */
async function deleteHandler(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getApiUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  const job = await prisma.importJob.findFirst({ where: { id, userId: user.id } });
  if (!job) return NextResponse.json({ error: "not_found" }, { status: 404 });

  if (job.status === "ANALYZED" || job.status === "IMPORTING") {
    await prisma.importJob.update({ where: { id: job.id }, data: { status: "CANCELLED" } });
    return NextResponse.json({ data: { cancelled: true } });
  }

  return NextResponse.json({ error: "job_not_cancellable" }, { status: 409 });
}

export const GET = withApiObservability("data.import.get", getHandler);
export const PATCH = withApiObservability("data.import.update", patchHandler);
export const DELETE = withApiObservability("data.import.cancel", deleteHandler);

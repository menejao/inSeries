import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { getAdminApiUser } from "@/lib/admin/rbac";
import { withApiObservability } from "@/lib/http/api-handler";
import { checkRateLimit, getClientIdentifier } from "@/lib/rate-limit";
import { contentRepo } from "@/packages/social-automation/src/db/content-repo";
import { renderPreview } from "@/packages/social-automation/src/template-engine";
import type { OutputFormat } from "@/packages/social-automation/src/template-engine/types";
import type { ContentPayload } from "@/packages/social-automation/src/content-engine/types";

/**
 * INSERIES-SOCIAL-TEMPLATE-ENGINE-04 — real PNG preview of a stored SocialContent.
 *
 * It renders through the SAME `render()` (Playwright) the publisher would use: there is no
 * separate "preview renderer", so the admin sees exactly the bytes that would be uploaded.
 *
 * Read-only: nothing is persisted, no audit entry is written (this is a GET), no network is hit by
 * the render itself (the documents are fully self-contained).
 *
 * GET /api/admin/social/content/:id/preview/:format?slide=2
 */

const FORMATS: OutputFormat[] = ["feed", "carousel", "story"];

function isFormat(value: string): value is OutputFormat {
  return (FORMATS as string[]).includes(value);
}

/** Versao do conteudo para a chave do cache de preview — hash estavel do payload persistido. */
function payloadVersion(payload: unknown): string {
  return createHash("sha1").update(JSON.stringify(payload ?? null)).digest("hex").slice(0, 16);
}

async function previewHandler(request: Request, { params }: { params: Promise<{ id: string; format: string }> }) {
  const admin = await getAdminApiUser("admin.social");
  if (!admin) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const rateLimit = checkRateLimit("admin", getClientIdentifier(request));
  if (!rateLimit.allowed) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const { id, format } = await params;
  if (!isFormat(format)) {
    return NextResponse.json({ error: "invalid_format", supported: FORMATS }, { status: 400 });
  }

  const content = await contentRepo.findByIdWithRelations(id);
  if (!content) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const payload = content.payload as ContentPayload | null;
  if (!payload || typeof payload !== "object") {
    return NextResponse.json({ error: "invalid_payload" }, { status: 422 });
  }

  const slideParam = new URL(request.url).searchParams.get("slide");
  const slideIndex = slideParam ? Math.max(Number.parseInt(slideParam, 10) - 1, 0) : 0;

  try {
    // A rota nunca cria browser proprio: chama o renderer compartilhado. O cache de curta duracao
    // (60s, em memoria) e chaveado por conteudo+versao. `SocialContent` nao tem `updatedAt`, entao
    // a versao e um hash do payload: qualquer edicao muda a chave e invalida a entrada sozinha.
    const image = await renderPreview(payload, format, {
      slideIndex: Number.isNaN(slideIndex) ? 0 : slideIndex,
      cache: { contentId: id, version: payloadVersion(content.payload) }
    });
    return new NextResponse(new Uint8Array(image.buffer), {
      status: 200,
      headers: {
        "Content-Type": "image/png",
        "Content-Length": String(image.buffer.byteLength),
        "Content-Disposition": `inline; filename="${image.fileName}"`,
        "X-Image-Alt": encodeURIComponent(image.altText),
        // Previews are cheap to regenerate and must reflect edits immediately.
        "Cache-Control": "no-store"
      }
    });
  } catch (error) {
    // Unsupported format for the template, invalid payload or a missing Chromium all land here —
    // all of them are "this preview cannot be produced", not a server fault.
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: "preview_failed", message }, { status: 422 });
  }
}

export const GET = withApiObservability("admin.social.content.preview", previewHandler);

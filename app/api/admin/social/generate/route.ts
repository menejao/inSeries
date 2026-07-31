import { NextResponse } from "next/server";
import { getAdminApiUser } from "@/lib/admin/rbac";
import { recordAdminAudit } from "@/lib/admin/audit";
import { withApiObservability } from "@/lib/http/api-handler";
import { checkRateLimit, getClientIdentifier } from "@/lib/rate-limit";
import { generateContentNow, AutomationPausedError } from "@/packages/social-automation/src/content-engine/generate-now";

/**
 * INSERIES-SOCIAL-ADMIN-PANEL-03 — "Gerar conteudo agora".
 *
 * Delegates to generateContentNow(), the same wrapper around selectTopic() that
 * packages/social-automation/scripts/content-generate.ts uses, so the panel and the CLI produce
 * byte-identical content through one code path. No selection/scoring logic exists in this file.
 */
async function generateHandler(request: Request) {
  const admin = await getAdminApiUser("admin.social");
  if (!admin) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const rateLimit = checkRateLimit("sync", getClientIdentifier(request));
  if (!rateLimit.allowed) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  try {
    const { content, payload } = await generateContentNow({ persist: true });

    await recordAdminAudit({
      adminUserId: admin.id,
      action: "SOCIAL_GENERATE_CONTENT",
      entity: "SocialContent",
      entityId: content?.id ?? null,
      metadata: { format: payload.format, title: payload.title }
    });

    return NextResponse.json({ ok: true, contentId: content?.id ?? null, format: payload.format, title: payload.title });
  } catch (error) {
    const paused = error instanceof AutomationPausedError;
    const message = error instanceof Error ? error.message : String(error);

    // Audited as a *attempt* even when it fails — the ticket requires manual generation attempts
    // to leave an audit trail regardless of outcome.
    await recordAdminAudit({
      adminUserId: admin.id,
      action: "SOCIAL_GENERATE_CONTENT",
      entity: "SocialContent",
      entityId: null,
      metadata: { error: message },
      result: paused ? "REJECTED" : "FAILURE"
    });

    return NextResponse.json({ error: paused ? "automation_paused" : "generation_failed", message }, { status: paused ? 409 : 500 });
  }
}

export const POST = withApiObservability("admin.social.generate", generateHandler);

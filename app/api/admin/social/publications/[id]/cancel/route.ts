import { NextResponse } from "next/server";
import { getAdminApiUser } from "@/lib/admin/rbac";
import { recordAdminAudit } from "@/lib/admin/audit";
import { withApiObservability } from "@/lib/http/api-handler";
import { checkRateLimit, getClientIdentifier } from "@/lib/rate-limit";
import { cancelPublication } from "@/packages/social-automation/src/publisher/services/publish-service";
import { isPublishError } from "@/packages/social-automation/src/publisher/instagram/errors";

/**
 * INSERIES-INSTAGRAM-PUBLISHER-05 — "Cancelar" a PENDING/SCHEDULED/FAILED publication.
 *
 * The row is never deleted; only its status moves to CANCELLED. A reason is mandatory (validated
 * in publish-service.ts, not here, so the CLI and the panel behave identically — the same lesson
 * as the rejection reason in ticket-03-QA).
 */
async function cancelHandler(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdminApiUser("admin.social");
  if (!admin) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const rateLimit = checkRateLimit("admin", getClientIdentifier(request));
  if (!rateLimit.allowed) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const reason = typeof body.reason === "string" ? body.reason : "";

  if (!reason.trim()) {
    return NextResponse.json({ error: "reason_required", message: "Informe o motivo do cancelamento." }, { status: 400 });
  }

  try {
    const publication = await cancelPublication(id, reason);

    await recordAdminAudit({
      adminUserId: admin.id,
      action: "SOCIAL_CANCEL_PUBLICATION",
      entity: "SocialPublication",
      entityId: id,
      metadata: { reason: reason.trim(), status: publication.status }
    });

    return NextResponse.json({ ok: true, status: publication.status });
  } catch (error) {
    const message = isPublishError(error) ? error.toAdminMessage() : error instanceof Error ? error.message : String(error);

    await recordAdminAudit({
      adminUserId: admin.id,
      action: "SOCIAL_CANCEL_PUBLICATION",
      entity: "SocialPublication",
      entityId: id,
      metadata: { error: message },
      result: "FAILURE"
    });

    return NextResponse.json({ error: "action_failed", message }, { status: 422 });
  }
}

export const POST = withApiObservability("admin.social.publications.cancel", cancelHandler);

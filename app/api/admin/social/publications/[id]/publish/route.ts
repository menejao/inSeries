import { NextResponse } from "next/server";
import { getAdminApiUser } from "@/lib/admin/rbac";
import { recordAdminAudit } from "@/lib/admin/audit";
import { withApiObservability } from "@/lib/http/api-handler";
import { checkRateLimit, getClientIdentifier } from "@/lib/rate-limit";
import { publishPublication } from "@/packages/social-automation/src/publisher/services/publish-service";
import { isPublishError } from "@/packages/social-automation/src/publisher/instagram/errors";

/**
 * INSERIES-INSTAGRAM-PUBLISHER-05 — "Publicar agora".
 *
 * Every rule (is this status publishable? is the slot due? retry? idempotency?) lives in
 * publish-service.ts; this route only authenticates, rate-limits, audits and translates the error
 * into a friendly message. `admin.social` is ADMIN-only in lib/admin/rbac.ts, so a MODERATOR gets
 * 403 here exactly like on every other social route.
 */
async function publishHandler(request: Request, { params }: { params: Promise<{ id: string }> }) {
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
  const force = body.force === true;

  try {
    const result = await publishPublication(id, { force });

    await recordAdminAudit({
      adminUserId: admin.id,
      action: "SOCIAL_PUBLISH_PUBLICATION",
      entity: "SocialPublication",
      entityId: id,
      metadata: { force, status: result.status, attempts: result.attempts, skippedReason: result.skippedReason ?? null }
    });

    return NextResponse.json({
      ok: true,
      status: result.status,
      externalId: result.externalId ?? null,
      attempts: result.attempts,
      skippedReason: result.skippedReason ?? null
    });
  } catch (error) {
    // PublishError messages are already masked (no token, no stack) — safe to show an admin.
    const message = isPublishError(error) ? error.toAdminMessage() : error instanceof Error ? error.message : String(error);

    await recordAdminAudit({
      adminUserId: admin.id,
      action: "SOCIAL_PUBLISH_PUBLICATION",
      entity: "SocialPublication",
      entityId: id,
      metadata: { force, error: message, kind: isPublishError(error) ? error.kind : "unknown" },
      result: "FAILURE"
    });

    return NextResponse.json({ error: "action_failed", message }, { status: 422 });
  }
}

export const POST = withApiObservability("admin.social.publications.publish", publishHandler);

import { NextResponse } from "next/server";
import { getAdminApiUser } from "@/lib/admin/rbac";
import { recordAdminAudit } from "@/lib/admin/audit";
import { withApiObservability } from "@/lib/http/api-handler";
import { checkRateLimit, getClientIdentifier } from "@/lib/rate-limit";
import { refreshPublicationStatus } from "@/packages/social-automation/src/publisher/services/publish-service";
import { isPublishError } from "@/packages/social-automation/src/publisher/instagram/errors";

/**
 * INSERIES-INSTAGRAM-PUBLISHER-05 — "Atualizar status".
 *
 * Read-only: asks the Graph API what it currently thinks of the published container. With only the
 * ConsoleLogPublisher registered (every non-production environment) it returns a `note` explaining
 * that no real integration is active instead of pretending to have checked anything.
 */
async function refreshStatusHandler(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdminApiUser("admin.social");
  if (!admin) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const rateLimit = checkRateLimit("admin", getClientIdentifier(request));
  if (!rateLimit.allowed) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const { id } = await params;

  try {
    const result = await refreshPublicationStatus(id);

    await recordAdminAudit({
      adminUserId: admin.id,
      action: "SOCIAL_REFRESH_PUBLICATION_STATUS",
      entity: "SocialPublication",
      entityId: id,
      metadata: { status: result.status, statusCode: result.container?.statusCode ?? null }
    });

    return NextResponse.json({
      ok: true,
      status: result.status,
      externalId: result.externalId,
      statusCode: result.container?.statusCode ?? null,
      note: result.note ?? null
    });
  } catch (error) {
    const message = isPublishError(error) ? error.toAdminMessage() : error instanceof Error ? error.message : String(error);

    await recordAdminAudit({
      adminUserId: admin.id,
      action: "SOCIAL_REFRESH_PUBLICATION_STATUS",
      entity: "SocialPublication",
      entityId: id,
      metadata: { error: message },
      result: "FAILURE"
    });

    return NextResponse.json({ error: "action_failed", message }, { status: 422 });
  }
}

export const POST = withApiObservability("admin.social.publications.refresh-status", refreshStatusHandler);

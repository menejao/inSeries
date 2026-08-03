import { NextResponse } from "next/server";
import { getAdminApiUser } from "@/lib/admin/rbac";
import { recordAdminAudit } from "@/lib/admin/audit";
import { withApiObservability } from "@/lib/http/api-handler";
import { checkRateLimit, getClientIdentifier } from "@/lib/rate-limit";
import { schedulePublication } from "@/packages/social-automation/src/publisher/services/publish-service";
import { isPublishError } from "@/packages/social-automation/src/publisher/instagram/errors";

/**
 * INSERIES-INSTAGRAM-PUBLISHER-05 — "Agendar" for a future slot.
 *
 * Distinct from the pre-existing /reschedule route (ticket-03), which is the generic "move the
 * slot" action backed by content-engine/approval.ts. This one is the publisher's own scheduling
 * entry point: it refuses UPLOADING/PUBLISHING/CANCELLED rows and records the transition through
 * the publisher's history vocabulary. `scheduledFor` must be an ISO-8601 instant (UTC).
 */
async function scheduleHandler(request: Request, { params }: { params: Promise<{ id: string }> }) {
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
  const scheduledFor = typeof body.scheduledFor === "string" ? new Date(body.scheduledFor) : new Date(NaN);

  if (Number.isNaN(scheduledFor.getTime())) {
    return NextResponse.json({ error: "invalid_scheduled_for", message: "Data e hora invalidas." }, { status: 400 });
  }

  try {
    const publication = await schedulePublication(id, scheduledFor);

    await recordAdminAudit({
      adminUserId: admin.id,
      action: "SOCIAL_SCHEDULE_PUBLICATION",
      entity: "SocialPublication",
      entityId: id,
      metadata: { scheduledFor: scheduledFor.toISOString(), status: publication.status }
    });

    return NextResponse.json({ ok: true, status: publication.status, scheduledFor: publication.scheduledFor.toISOString() });
  } catch (error) {
    const message = isPublishError(error) ? error.toAdminMessage() : error instanceof Error ? error.message : String(error);

    await recordAdminAudit({
      adminUserId: admin.id,
      action: "SOCIAL_SCHEDULE_PUBLICATION",
      entity: "SocialPublication",
      entityId: id,
      metadata: { error: message },
      result: "FAILURE"
    });

    return NextResponse.json({ error: "action_failed", message }, { status: 422 });
  }
}

export const POST = withApiObservability("admin.social.publications.schedule", scheduleHandler);

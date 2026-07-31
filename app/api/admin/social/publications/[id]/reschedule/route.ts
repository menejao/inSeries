import { NextResponse } from "next/server";
import { getAdminApiUser } from "@/lib/admin/rbac";
import { recordAdminAudit } from "@/lib/admin/audit";
import { withApiObservability } from "@/lib/http/api-handler";
import { checkRateLimit, getClientIdentifier } from "@/lib/rate-limit";
import { reschedulePublication } from "@/packages/social-automation/src/content-engine/approval";

/** INSERIES-SOCIAL-ADMIN-PANEL-03 — moves a not-yet-published slot. All rules live in approval.ts. */
async function rescheduleHandler(request: Request, { params }: { params: Promise<{ id: string }> }) {
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
    return NextResponse.json({ error: "invalid_scheduled_for" }, { status: 400 });
  }

  try {
    const publication = await reschedulePublication(id, scheduledFor);

    await recordAdminAudit({
      adminUserId: admin.id,
      action: "SOCIAL_RESCHEDULE_PUBLICATION",
      entity: "SocialPublication",
      entityId: publication.id,
      metadata: { scheduledFor: scheduledFor.toISOString(), status: publication.status }
    });

    return NextResponse.json({ ok: true, scheduledFor: publication.scheduledFor.toISOString(), status: publication.status });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    await recordAdminAudit({
      adminUserId: admin.id,
      action: "SOCIAL_RESCHEDULE_PUBLICATION",
      entity: "SocialPublication",
      entityId: id,
      metadata: { error: message },
      result: "FAILURE"
    });

    return NextResponse.json({ error: "action_failed", message }, { status: 422 });
  }
}

export const POST = withApiObservability("admin.social.publications.reschedule", rescheduleHandler);

import { NextResponse } from "next/server";
import { getAdminApiUser } from "@/lib/admin/rbac";
import { recordAdminAudit } from "@/lib/admin/audit";
import { withApiObservability } from "@/lib/http/api-handler";
import { checkRateLimit, getClientIdentifier } from "@/lib/rate-limit";
import { templateRepo } from "@/packages/social-automation/src/db/template-repo";

/** INSERIES-SOCIAL-ADMIN-PANEL-03 — activate/deactivate a SocialTemplate (a single boolean column). */
async function toggleTemplateHandler(request: Request, { params }: { params: Promise<{ id: string }> }) {
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

  if (typeof body.active !== "boolean") {
    return NextResponse.json({ error: "invalid_active" }, { status: 400 });
  }

  try {
    const template = await templateRepo.setActive(id, body.active);

    await recordAdminAudit({
      adminUserId: admin.id,
      action: template.active ? "SOCIAL_ACTIVATE_TEMPLATE" : "SOCIAL_DEACTIVATE_TEMPLATE",
      entity: "SocialTemplate",
      entityId: template.id,
      metadata: { name: template.name, active: template.active }
    });

    return NextResponse.json({ ok: true, active: template.active });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: "action_failed", message }, { status: 422 });
  }
}

export const POST = withApiObservability("admin.social.templates.toggle", toggleTemplateHandler);

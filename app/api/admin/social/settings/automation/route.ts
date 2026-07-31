import { NextResponse } from "next/server";
import { getAdminApiUser } from "@/lib/admin/rbac";
import { recordAdminAudit } from "@/lib/admin/audit";
import { withApiObservability } from "@/lib/http/api-handler";
import { checkRateLimit, getClientIdentifier } from "@/lib/rate-limit";
import { setAutomationPaused } from "@/packages/social-automation/src/settings";

/**
 * INSERIES-SOCIAL-ADMIN-PANEL-03 — the ONLY writable configuration in the panel: pause/resume.
 * Persisted through settings/index.ts into the pre-existing SystemSetting table (no migration).
 * Every other value on the Configuracoes screen is env-var driven and rendered read-only.
 */
async function automationSettingsHandler(request: Request) {
  const admin = await getAdminApiUser("admin.social");
  if (!admin) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const rateLimit = checkRateLimit("admin", getClientIdentifier(request));
  if (!rateLimit.allowed) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;

  if (typeof body.paused !== "boolean") {
    return NextResponse.json({ error: "invalid_paused" }, { status: 400 });
  }

  const reason = typeof body.reason === "string" && body.reason.trim() ? body.reason.trim() : null;
  const state = await setAutomationPaused(body.paused, reason);

  await recordAdminAudit({
    adminUserId: admin.id,
    action: state.paused ? "SOCIAL_PAUSE_AUTOMATION" : "SOCIAL_RESUME_AUTOMATION",
    entity: "SystemSetting",
    entityId: "social_automation.paused",
    metadata: { paused: state.paused, reason: state.reason }
  });

  return NextResponse.json({ ok: true, paused: state.paused, reason: state.reason });
}

export const POST = withApiObservability("admin.social.settings.automation", automationSettingsHandler);

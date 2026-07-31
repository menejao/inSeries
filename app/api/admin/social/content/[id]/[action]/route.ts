import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { getAdminApiUser } from "@/lib/admin/rbac";
import { recordAdminAudit } from "@/lib/admin/audit";
import { withApiObservability } from "@/lib/http/api-handler";
import { checkRateLimit, getClientIdentifier } from "@/lib/rate-limit";
import {
  approveContent,
  approveAndSchedule,
  editContent,
  rejectContent,
  revertToDraft,
  submitForApproval
} from "@/packages/social-automation/src/content-engine/approval";

/**
 * INSERIES-SOCIAL-ADMIN-PANEL-03 — every per-content review action, one route, same shape as
 * app/api/admin/sync/[type]/route.ts.
 *
 * Each handler is a one-line delegation to a content-engine service function. All the rules —
 * which status transitions are legal, CTA validation, history recording — live in approval.ts,
 * which is also what packages/social-automation/scripts/content-{approve,reject}.ts call. There is
 * deliberately no decision logic in this file beyond parsing the request body.
 */

type ActionResult = { entityId: string | null; metadata: Prisma.InputJsonObject };

const ACTIONS = {
  submit: async (id: string): Promise<ActionResult> => {
    const content = await submitForApproval(id);
    return { entityId: content.id, metadata: { status: content.status } };
  },

  approve: async (id: string): Promise<ActionResult> => {
    const content = await approveContent(id);
    return { entityId: content.id, metadata: { status: content.status } };
  },

  reject: async (id: string, body: Record<string, unknown>): Promise<ActionResult> => {
    const reason = typeof body.reason === "string" && body.reason.trim() ? body.reason.trim() : undefined;
    const content = await rejectContent(id, reason);
    return { entityId: content.id, metadata: { status: content.status, reason: reason ?? null } };
  },

  edit: async (id: string, body: Record<string, unknown>): Promise<ActionResult> => {
    const content = await editContent(id, {
      title: typeof body.title === "string" ? body.title : undefined,
      caption: typeof body.caption === "string" ? body.caption : undefined,
      ctaText: typeof body.ctaText === "string" ? body.ctaText : undefined,
      hashtags: Array.isArray(body.hashtags) ? body.hashtags.filter((tag): tag is string => typeof tag === "string") : undefined
    });
    return { entityId: content.id, metadata: { status: content.status, editedFields: Object.keys(body) } };
  },

  draft: async (id: string): Promise<ActionResult> => {
    const content = await revertToDraft(id);
    return { entityId: content.id, metadata: { status: content.status } };
  },

  schedule: async (id: string, body: Record<string, unknown>): Promise<ActionResult> => {
    const scheduledFor = typeof body.scheduledFor === "string" ? new Date(body.scheduledFor) : new Date(NaN);
    if (Number.isNaN(scheduledFor.getTime())) {
      throw new Error("schedule: \"scheduledFor\" ausente ou invalido (esperado ISO 8601).");
    }
    const { content, publication } = await approveAndSchedule(id, scheduledFor);
    return {
      entityId: content.id,
      metadata: { status: content.status, publicationId: publication.id, scheduledFor: scheduledFor.toISOString() }
    };
  }
} as const;

type ActionKey = keyof typeof ACTIONS;

function isValidAction(value: string): value is ActionKey {
  return value in ACTIONS;
}

/** Audit action names are per-operation so the audit log is filterable, per the ticket. */
const AUDIT_ACTIONS: Record<ActionKey, string> = {
  submit: "SOCIAL_SUBMIT_CONTENT",
  approve: "SOCIAL_APPROVE_CONTENT",
  reject: "SOCIAL_REJECT_CONTENT",
  edit: "SOCIAL_EDIT_CONTENT",
  draft: "SOCIAL_REVERT_CONTENT_TO_DRAFT",
  schedule: "SOCIAL_APPROVE_AND_SCHEDULE_CONTENT"
};

async function contentActionHandler(request: Request, { params }: { params: Promise<{ id: string; action: string }> }) {
  const admin = await getAdminApiUser("admin.social");
  if (!admin) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const rateLimit = checkRateLimit("admin", getClientIdentifier(request));
  if (!rateLimit.allowed) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const { id, action } = await params;
  if (!isValidAction(action)) {
    return NextResponse.json({ error: "invalid_action" }, { status: 400 });
  }

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;

  try {
    const result = await ACTIONS[action](id, body);

    await recordAdminAudit({
      adminUserId: admin.id,
      action: AUDIT_ACTIONS[action],
      entity: "SocialContent",
      entityId: result.entityId,
      metadata: result.metadata
    });

    return NextResponse.json({ ok: true, ...result.metadata });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    await recordAdminAudit({
      adminUserId: admin.id,
      action: AUDIT_ACTIONS[action],
      entity: "SocialContent",
      entityId: id,
      metadata: { error: message },
      result: "FAILURE"
    });

    // The service functions throw on illegal transitions and on CTA violations — both are the
    // caller's fault, so 422 rather than 500.
    return NextResponse.json({ error: "action_failed", message }, { status: 422 });
  }
}

export const POST = withApiObservability("admin.social.content.action", contentActionHandler);

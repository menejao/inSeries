import { contentRepo } from "../db/content-repo";
import { publicationRepo } from "../db/publication-repo";
import { recordHistory } from "../history";
import { logger } from "../logger";
import { assertValidCta } from "./cta-validation";
import type { ContentPayload } from "./types";
import type { SocialContent, SocialNetwork, SocialPublication } from "@prisma/client";

/**
 * Design decision (ticket section 8): manual-flow.approve() is left untouched — it only accepts
 * DRAFT -> APPROVED and is the entry point for the pre-existing ManualContentGenerator flow,
 * which never produces PENDING_APPROVAL content. Content-engine content additionally supports an
 * explicit "submit for review" step (DRAFT -> PENDING_APPROVAL) before approval, so this module
 * is layered in front instead of loosening manual-flow: `approveContent` here accepts content in
 * either DRAFT or PENDING_APPROVAL (a content-engine draft can be approved directly without an
 * explicit submit step, or after one) so both flows converge on APPROVED without manual-flow.ts
 * needing to know about PENDING_APPROVAL at all.
 */

/**
 * Reads the CTA text off a content-engine payload. Returns `null` for rows that have no payload
 * at all — those come from the ManualContentGenerator (manual-flow/), which never builds a
 * structured payload and therefore has no CTA to validate. Returning null makes the CTA gate
 * below a no-op for them instead of retroactively blocking a pre-existing flow.
 */
function extractCtaText(content: SocialContent): string | null {
  const payload = content.payload as ContentPayload | null;
  if (!payload || typeof payload !== "object") return null;
  const cta = payload.cta;
  if (!cta || typeof cta !== "object") return null;
  return typeof cta.text === "string" ? cta.text : null;
}

/** The definitive backend CTA gate. Skipped only for payload-less (manual-flow) content — see extractCtaText. */
function assertContentCtaIsValid(content: SocialContent): void {
  const ctaText = extractCtaText(content);
  if (ctaText === null) return;
  assertValidCta(ctaText);
}

export async function submitForApproval(contentId: string): Promise<SocialContent> {
  const content = await contentRepo.findById(contentId);
  if (!content) throw new Error(`submitForApproval: SocialContent "${contentId}" not found`);
  if (content.status !== "DRAFT") {
    throw new Error(`submitForApproval: SocialContent "${contentId}" is "${content.status}", expected "DRAFT"`);
  }

  const updated = await contentRepo.updateStatus(contentId, "PENDING_APPROVAL");
  await recordHistory({ action: "CONTENT_SUBMITTED_FOR_APPROVAL", contentId, detail: { transition: "DRAFT->PENDING_APPROVAL" } });
  logger.info("content-engine:approval:submitted", { module: "content-engine", metadata: { contentId } });
  return updated;
}

export async function approveContent(contentId: string): Promise<SocialContent> {
  const content = await contentRepo.findById(contentId);
  if (!content) throw new Error(`approveContent: SocialContent "${contentId}" not found`);
  if (content.status !== "PENDING_APPROVAL" && content.status !== "DRAFT") {
    throw new Error(`approveContent: SocialContent "${contentId}" is "${content.status}", expected "DRAFT" or "PENDING_APPROVAL"`);
  }

  assertContentCtaIsValid(content);

  const updated = await contentRepo.updateStatus(contentId, "APPROVED");
  await recordHistory({ action: "CONTENT_APPROVED", contentId, detail: { transition: `${content.status}->APPROVED` } });
  logger.info("content-engine:approval:approved", { module: "content-engine", metadata: { contentId } });
  return updated;
}

/**
 * INSERIES-SOCIAL-ADMIN-PANEL-03-QA — "Ao rejeitar: exigir motivo" is a ticket requirement, not
 * UX-only: the reason must be validated here so the panel's Client Component and the
 * `social:content:reject` CLI script produce identical results (both call this function, neither
 * enforced this before — found during QA by calling the API with no reason and getting a silent
 * 200/REJECTED).
 */
export async function rejectContent(contentId: string, reason?: string): Promise<SocialContent> {
  const trimmedReason = reason?.trim();
  if (!trimmedReason) {
    throw new Error("rejectContent: um motivo e obrigatorio para rejeitar conteudo.");
  }

  const content = await contentRepo.findById(contentId);
  if (!content) throw new Error(`rejectContent: SocialContent "${contentId}" not found`);
  if (content.status !== "PENDING_APPROVAL" && content.status !== "DRAFT") {
    throw new Error(`rejectContent: SocialContent "${contentId}" is "${content.status}", expected "DRAFT" or "PENDING_APPROVAL"`);
  }

  const updated = await contentRepo.updateStatus(contentId, "REJECTED");
  await recordHistory({ action: "CONTENT_REJECTED", contentId, detail: { transition: `${content.status}->REJECTED`, reason: trimmedReason } });
  logger.info("content-engine:approval:rejected", { module: "content-engine", metadata: { contentId, reason: trimmedReason } });
  return updated;
}

// ---------------------------------------------------------------------------
// INSERIES-SOCIAL-ADMIN-PANEL-03 — service functions backing the admin review
// screen. They live here (not in app/admin/social/**) so the panel stays pure
// presentation and the CLI could adopt them unchanged.
// ---------------------------------------------------------------------------

export interface EditContentInput {
  title?: string;
  caption?: string;
  ctaText?: string;
  hashtags?: string[];
}

/**
 * Applies a reviewer's edits to a DRAFT/PENDING_APPROVAL content item, keeping the structured
 * payload and the flat columns in sync (description mirrors payload.caption, as select-topic.ts
 * writes it). The CTA gate runs on the *incoming* text, so a reviewer can never save a CTA that
 * would later be rejected at approval time.
 */
export async function editContent(contentId: string, input: EditContentInput): Promise<SocialContent> {
  const content = await contentRepo.findById(contentId);
  if (!content) throw new Error(`editContent: SocialContent "${contentId}" not found`);
  if (content.status !== "DRAFT" && content.status !== "PENDING_APPROVAL") {
    throw new Error(`editContent: SocialContent "${contentId}" is "${content.status}", expected "DRAFT" or "PENDING_APPROVAL"`);
  }

  const payload = (content.payload as ContentPayload | null) ?? null;

  if (input.ctaText !== undefined) {
    assertValidCta(input.ctaText);
  }

  const nextTitle = input.title?.trim() || content.title;
  const nextCaption = input.caption ?? payload?.caption ?? content.description;

  const nextPayload: ContentPayload | null = payload
    ? {
        ...payload,
        title: nextTitle,
        caption: nextCaption,
        cta: input.ctaText !== undefined ? { ...payload.cta, text: input.ctaText } : payload.cta,
        hashtags: input.hashtags ?? payload.hashtags
      }
    : null;

  const updated = await contentRepo.updateEditableFields(contentId, {
    title: nextTitle,
    description: nextCaption,
    payload: nextPayload as unknown as Record<string, unknown> | null
  });

  await recordHistory({
    action: "CONTENT_SUBMITTED_FOR_APPROVAL",
    contentId,
    detail: {
      transition: "edited",
      editedFields: Object.keys(input).filter((key) => input[key as keyof EditContentInput] !== undefined)
    }
  });
  logger.info("content-engine:approval:edited", { module: "content-engine", metadata: { contentId } });

  return updated;
}

/** Sends APPROVED/REJECTED content back to DRAFT so it can be reworked. */
export async function revertToDraft(contentId: string): Promise<SocialContent> {
  const content = await contentRepo.findById(contentId);
  if (!content) throw new Error(`revertToDraft: SocialContent "${contentId}" not found`);
  if (content.status !== "APPROVED" && content.status !== "REJECTED" && content.status !== "PENDING_APPROVAL") {
    throw new Error(
      `revertToDraft: SocialContent "${contentId}" is "${content.status}", expected "PENDING_APPROVAL", "APPROVED" or "REJECTED"`
    );
  }

  const updated = await contentRepo.updateStatus(contentId, "DRAFT");
  await recordHistory({ action: "CONTENT_SUBMITTED_FOR_APPROVAL", contentId, detail: { transition: `${content.status}->DRAFT` } });
  logger.info("content-engine:approval:reverted-to-draft", { module: "content-engine", metadata: { contentId } });
  return updated;
}

export interface ApproveAndScheduleResult {
  content: SocialContent;
  publication: SocialPublication;
}

/**
 * Approves (via the same approveContent above — one code path, one CTA gate) and creates the
 * PENDING SocialPublication row for the chosen slot. No real network call happens: only the
 * ConsoleLogPublisher is registered today, so this schedules an intent, nothing more.
 */
export async function approveAndSchedule(
  contentId: string,
  scheduledFor: Date,
  network: SocialNetwork = "INSTAGRAM"
): Promise<ApproveAndScheduleResult> {
  const content = await approveContent(contentId);
  const payload = content.payload as ContentPayload | null;

  const publication = await publicationRepo.create({
    contentId: content.id,
    network,
    caption: payload?.caption ?? content.description,
    scheduledFor
  });

  await recordHistory({
    action: "RETRY_SCHEDULED",
    contentId: content.id,
    publicationId: publication.id,
    detail: { scheduledFor: scheduledFor.toISOString(), network }
  });

  return { content, publication };
}

/** Moves an existing publication to a new slot. Only slots that have not gone out yet. */
export async function reschedulePublication(publicationId: string, scheduledFor: Date): Promise<SocialPublication> {
  const publication = await publicationRepo.findById(publicationId);
  if (!publication) throw new Error(`reschedulePublication: SocialPublication "${publicationId}" not found`);
  if (publication.status === "PUBLISHED" || publication.status === "PUBLISHING") {
    throw new Error(`reschedulePublication: SocialPublication "${publicationId}" is "${publication.status}" and cannot be rescheduled`);
  }

  const updated = await publicationRepo.reschedule(publicationId, scheduledFor);

  await recordHistory({
    action: "RETRY_SCHEDULED",
    contentId: publication.contentId,
    publicationId,
    detail: { from: publication.scheduledFor.toISOString(), to: scheduledFor.toISOString() }
  });

  return updated;
}

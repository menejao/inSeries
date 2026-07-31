import { contentRepo } from "../db/content-repo";
import { recordHistory } from "../history";
import { logger } from "../logger";
import type { SocialContent } from "@prisma/client";

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

  const updated = await contentRepo.updateStatus(contentId, "APPROVED");
  await recordHistory({ action: "CONTENT_APPROVED", contentId, detail: { transition: `${content.status}->APPROVED` } });
  logger.info("content-engine:approval:approved", { module: "content-engine", metadata: { contentId } });
  return updated;
}

export async function rejectContent(contentId: string, reason?: string): Promise<SocialContent> {
  const content = await contentRepo.findById(contentId);
  if (!content) throw new Error(`rejectContent: SocialContent "${contentId}" not found`);
  if (content.status !== "PENDING_APPROVAL" && content.status !== "DRAFT") {
    throw new Error(`rejectContent: SocialContent "${contentId}" is "${content.status}", expected "DRAFT" or "PENDING_APPROVAL"`);
  }

  const updated = await contentRepo.updateStatus(contentId, "REJECTED");
  await recordHistory({ action: "CONTENT_REJECTED", contentId, detail: { transition: `${content.status}->REJECTED`, reason: reason ?? null } });
  logger.info("content-engine:approval:rejected", { module: "content-engine", metadata: { contentId, reason } });
  return updated;
}

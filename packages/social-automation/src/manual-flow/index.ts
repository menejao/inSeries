import { ManualContentGenerator, type GenerateContentInput } from "../content-generator";
import { PassthroughTemplateRenderer } from "../template-renderer";
import { PlaceholderMediaGenerator } from "../media-generator";
import { getPublisher } from "../publisher";
import { contentRepo } from "../db/content-repo";
import { publicationRepo } from "../db/publication-repo";
import { templateRepo } from "../db/template-repo";
import { recordHistory } from "../history";
import { logger } from "../logger";
import { isRealPublishAllowed, isNetworkEnabled } from "../config";
import type { SocialContent, SocialNetwork } from "@prisma/client";

const generator = new ManualContentGenerator();
const renderer = new PassthroughTemplateRenderer();
const mediaGenerator = new PlaceholderMediaGenerator();

/** Step 1: create a SocialContent DRAFT from manually supplied text. */
export async function generate(input: GenerateContentInput): Promise<SocialContent> {
  logger.info("manual-flow:generate:start", { module: "manual-flow", metadata: { title: input.title } });
  return generator.generate(input);
}

/** Step 2: human review — moves DRAFT -> APPROVED. Never skips a review step. */
export async function approve(contentId: string): Promise<SocialContent> {
  const content = await contentRepo.findById(contentId);
  if (!content) throw new Error(`approve: SocialContent "${contentId}" not found`);
  if (content.status !== "DRAFT") {
    throw new Error(`approve: SocialContent "${contentId}" is "${content.status}", expected "DRAFT"`);
  }

  const updated = await contentRepo.updateStatus(contentId, "APPROVED");

  await recordHistory({
    action: "CONTENT_GENERATED",
    contentId,
    detail: { transition: "DRAFT->APPROVED" }
  });

  logger.info("manual-flow:approve:done", { module: "manual-flow", metadata: { contentId } });

  return updated;
}

export interface PublishApprovedOptions {
  network?: SocialNetwork;
  scheduledFor?: Date;
}

/**
 * Step 3: renderer -> media-generator -> publisher -> history for an
 * APPROVED content item. Sets status PUBLISHED on success. On any failure,
 * the content row is never deleted — it's left/moved to FAILED (retryable)
 * so nothing is silently lost.
 */
export async function publishApproved(contentId: string, options: PublishApprovedOptions = {}): Promise<{ contentId: string; publicationId: string; externalId: string }> {
  const network: SocialNetwork = options.network ?? "INSTAGRAM";
  const scheduledFor = options.scheduledFor ?? new Date();

  const content = await contentRepo.findById(contentId);
  if (!content) throw new Error(`publishApproved: SocialContent "${contentId}" not found`);
  if (content.status !== "APPROVED") {
    throw new Error(`publishApproved: SocialContent "${contentId}" is "${content.status}", expected "APPROVED"`);
  }

  if (!isNetworkEnabled(network)) {
    throw new Error(`publishApproved: network "${network}" is not enabled in config.enabledNetworks`);
  }

  const template = content.templateId ? await templateRepo.findById(content.templateId) : null;

  let publicationId: string | undefined;

  try {
    const rendered = await renderer.render(content, template);
    const media = await mediaGenerator.generate(content);

    const publication = await publicationRepo.create({
      contentId: content.id,
      network,
      caption: rendered.caption,
      mediaRef: media.mediaRef,
      scheduledFor
    });
    publicationId = publication.id;

    await recordHistory({ action: "PUBLISH_ATTEMPTED", contentId: content.id, publicationId, detail: { network } });
    await publicationRepo.markPublishing(publication.id);

    if (!isRealPublishAllowed()) {
      logger.warn("manual-flow:publish:dev-noop", {
        module: "manual-flow",
        metadata: { contentId: content.id, publicationId, reason: "environment is not production — no real network call would be made anyway" }
      });
    }

    const publisher = getPublisher(network.toLowerCase());
    const result = await publisher.publish(publication);

    await publicationRepo.markPublished(publication.id, result.externalId);
    await contentRepo.updateStatus(content.id, "PUBLISHED");
    await recordHistory({ action: "PUBLISH_SUCCEEDED", contentId: content.id, publicationId, detail: { externalId: result.externalId } });

    return { contentId: content.id, publicationId, externalId: result.externalId };
  } catch (error) {
    // Never delete content on failure — persist a retryable failed state instead.
    await contentRepo.updateStatus(content.id, "FAILED").catch(() => undefined);
    if (publicationId) {
      await publicationRepo.markFailed(publicationId).catch(() => undefined);
    }

    await recordHistory({
      action: "PUBLISH_FAILED",
      contentId: content.id,
      publicationId,
      detail: { error: error instanceof Error ? error.message : String(error) }
    }).catch(() => undefined);

    logger.error("manual-flow:publish:failed", {
      module: "manual-flow",
      metadata: { contentId: content.id, publicationId, error: error instanceof Error ? error.message : String(error) }
    });

    throw error;
  }
}

export async function status(contentId: string) {
  const content = await contentRepo.findById(contentId);
  if (!content) throw new Error(`status: SocialContent "${contentId}" not found`);
  return content;
}

/**
 * INSERIES-INSTAGRAM-PUBLISHER-05 — the orchestrator.
 *
 * This is the only module that combines all the pieces, and the only one that writes to the
 * database. Everything below it is pure or single-purpose:
 *
 *   scheduler/  decides IF this publication should go out now
 *   queue/      guarantees it goes out at most once, one at a time
 *   retries/    decides whether a failure gets another attempt
 *   instagram/  performs the Graph API calls
 *   db/         persists status/attempts/lastError
 *   history/    records every transition (the package's non-negotiable rule)
 *
 * Nothing here knows what an HTTP status code is, and nothing in `instagram/` knows what Prisma is.
 *
 * ## History actions
 * `SocialAutomationAction` has no CANCELLED member and this ticket deliberately does not add one:
 * the schema changes were limited to what the ticket proved necessary (the two publication statuses
 * plus attempts/lastError). Cancellation is therefore recorded as `PUBLISH_FAILED` with an explicit
 * `detail.transition: "->CANCELLED"` marker, which keeps the audit trail complete and queryable
 * without a second enum migration. Flagged for review.
 */
import { publicationRepo } from "../../db/publication-repo";
import { contentRepo } from "../../db/content-repo";
import { recordHistory } from "../../history";
import { logger } from "../../logger";
import { isNetworkEnabled, isRealPublishAllowed, metaConfig } from "../../config";
import { getPublisher } from "../registry";
import { PublishQueue, publishQueue } from "../queue/publish-queue";
import { runWithRetry } from "../retries/retry-policy";
import { canCancel, decide, parseInstant } from "../scheduler/publish-scheduler";
import { InstagramGraphPublisher } from "../instagram/instagram-publisher";
import { PublishError, isPublishError } from "../instagram/errors";
import { toStoredError } from "../utils/mask";
import type { ContainerStatus, PublicationStatus, Publisher } from "../types";
import type { SocialPublication } from "@prisma/client";

/** The publisher-relevant view of a row, independent of the not-yet-migrated Prisma types. */
function view(publication: SocialPublication): { id: string; status: PublicationStatus; scheduledFor: Date } {
  return { id: publication.id, status: publication.status as PublicationStatus, scheduledFor: publication.scheduledFor };
}

export interface PublishServiceDeps {
  queue?: PublishQueue;
  /** Overrides the registry lookup. Tests inject a fake Publisher here. */
  publisher?: Publisher;
  sleep?: (ms: number) => Promise<void>;
  maxAttempts?: number;
  baseDelayMs?: number;
  now?: () => Date;
}

export interface PublishNowOptions extends PublishServiceDeps {
  /** The admin panel's "Publicar agora": ignores a future slot, never a terminal/in-flight status. */
  force?: boolean;
}

export interface PublishNowResult {
  publicationId: string;
  status: PublicationStatus;
  externalId?: string;
  attempts: number;
  /** Set when nothing was attempted (already published, cancelled, still in the future, …). */
  skippedReason?: string;
}

/**
 * Publishes one `SocialPublication` end to end.
 *
 * Idempotent on three levels: the in-memory queue collapses concurrent calls for the same id, the
 * DB status guard refuses rows that are already PUBLISHED/CANCELLED/in flight, and the scheduler
 * refuses a future slot unless `force` is set.
 */
export async function publishPublication(publicationId: string, options: PublishNowOptions = {}): Promise<PublishNowResult> {
  const queue = options.queue ?? publishQueue;
  const now = options.now ?? (() => new Date());

  return queue.run(publicationId, async () => {
    const publication = await publicationRepo.findById(publicationId);
    if (!publication) throw new Error(`publishPublication: SocialPublication "${publicationId}" nao encontrada.`);

    const decision = decide(view(publication), now(), { force: options.force });
    if (decision.action !== "publish-now") {
      logger.info("publisher:service:skipped", {
        module: "publisher",
        metadata: { publicationId, status: publication.status, action: decision.action, reason: decision.reason }
      });
      return {
        publicationId,
        status: publication.status as PublicationStatus,
        attempts: readAttempts(publication),
        skippedReason: decision.reason
      };
    }

    if (!isNetworkEnabled(publication.network)) {
      throw new Error(`publishPublication: rede "${publication.network}" nao esta habilitada em config.enabledNetworks.`);
    }

    const publisher = options.publisher ?? getPublisher(publication.network.toLowerCase());

    await recordHistory({
      action: "PUBLISH_ATTEMPTED",
      contentId: publication.contentId,
      publicationId,
      detail: { network: publication.network, forced: Boolean(options.force), realPublishAllowed: isRealPublishAllowed() }
    });

    await publicationRepo.markUploading(publicationId).catch(() => undefined);

    let attemptsSpent = readAttempts(publication);

    try {
      const outcome = await runWithRetry(
        async () => {
          await publicationRepo.incrementAttempts(publicationId).catch(() => undefined);
          await publicationRepo.updateStatus(publicationId, "PUBLISHING").catch(() => undefined);
          return publisher.publish(publication);
        },
        {
          maxAttempts: options.maxAttempts ?? metaConfig.retryLimit,
          ...(options.baseDelayMs !== undefined ? { baseDelayMs: options.baseDelayMs } : {}),
          ...(options.sleep ? { sleep: options.sleep } : {}),
          onAttempt: ({ attempt }) => {
            attemptsSpent = attempt;
          },
          onRetry: async ({ attempt, delayMs, error }) => {
            await recordHistory({
              action: "RETRY_SCHEDULED",
              contentId: publication.contentId,
              publicationId,
              detail: { attempt, delayMs, error: toStoredError(error), kind: isPublishError(error) ? error.kind : "unknown" }
            }).catch(() => undefined);
            await publicationRepo.markUploading(publicationId).catch(() => undefined);
          }
        }
      );

      await publicationRepo.markPublishedWithAttempts(publicationId, outcome.result.externalId, outcome.attempts);
      await contentRepo.updateStatus(publication.contentId, "PUBLISHED").catch(() => undefined);
      await recordHistory({
        action: "PUBLISH_SUCCEEDED",
        contentId: publication.contentId,
        publicationId,
        detail: { externalId: outcome.result.externalId, attempts: outcome.attempts }
      });

      logger.info("publisher:service:published", {
        module: "publisher",
        metadata: { publicationId, externalId: outcome.result.externalId, attempts: outcome.attempts }
      });

      return { publicationId, status: "PUBLISHED" as const, externalId: outcome.result.externalId, attempts: outcome.attempts };
    } catch (error) {
      const stored = toStoredError(error);

      await publicationRepo.markFailedWithError(publicationId, stored, attemptsSpent).catch(() => undefined);
      await contentRepo.updateStatus(publication.contentId, "FAILED").catch(() => undefined);
      await recordHistory({
        action: "PUBLISH_FAILED",
        contentId: publication.contentId,
        publicationId,
        detail: { error: stored, attempts: attemptsSpent, kind: isPublishError(error) ? error.kind : "unknown", retryable: isPublishError(error) ? error.retryable : null }
      }).catch(() => undefined);

      logger.error("publisher:service:failed", {
        module: "publisher",
        metadata: { publicationId, attempts: attemptsSpent, kind: isPublishError(error) ? error.kind : "unknown", error: stored }
      });

      throw error;
    }
  });
}

/** `attempts` does not exist on the generated client yet — read defensively (see publication-repo). */
function readAttempts(publication: SocialPublication): number {
  const value = (publication as unknown as { attempts?: unknown }).attempts;
  return typeof value === "number" ? value : 0;
}

/** Moves a not-yet-published slot to a new UTC instant and puts it back in SCHEDULED. */
export async function schedulePublication(publicationId: string, scheduledFor: Date | string): Promise<SocialPublication> {
  const instant = parseInstant(scheduledFor);
  const publication = await publicationRepo.findById(publicationId);
  if (!publication) throw new Error(`schedulePublication: SocialPublication "${publicationId}" nao encontrada.`);

  const status = publication.status as PublicationStatus;
  if (status === "PUBLISHED" || status === "PUBLISHING" || status === "UPLOADING" || status === "CANCELLED") {
    throw new PublishError("validation", `Publicacao esta "${status}" e nao pode ser reagendada.`);
  }

  const updated = await publicationRepo.reschedule(publicationId, instant);

  await recordHistory({
    action: "RETRY_SCHEDULED",
    contentId: publication.contentId,
    publicationId,
    detail: { from: publication.scheduledFor.toISOString(), to: instant.toISOString(), transition: `${status}->SCHEDULED` }
  });

  return updated;
}

/** PENDING/SCHEDULED/FAILED -> CANCELLED. The row is never deleted. */
export async function cancelPublication(publicationId: string, reason: string): Promise<SocialPublication> {
  const trimmed = reason?.trim();
  if (!trimmed) throw new PublishError("validation", "Um motivo e obrigatorio para cancelar uma publicacao.");

  const publication = await publicationRepo.findById(publicationId);
  if (!publication) throw new Error(`cancelPublication: SocialPublication "${publicationId}" nao encontrada.`);

  const status = publication.status as PublicationStatus;
  if (!canCancel(status)) {
    throw new PublishError("validation", `Publicacao esta "${status}" e nao pode ser cancelada.`);
  }

  const updated = await publicationRepo.markCancelled(publicationId, trimmed);

  await recordHistory({
    action: "PUBLISH_FAILED",
    contentId: publication.contentId,
    publicationId,
    detail: { transition: `${status}->CANCELLED`, cancelled: true, reason: trimmed }
  });

  logger.warn("publisher:service:cancelled", { module: "publisher", metadata: { publicationId, from: status } });

  return updated;
}

export interface RefreshStatusResult {
  publicationId: string;
  status: PublicationStatus;
  externalId: string | null;
  /** Null when the publisher cannot query Meta (ConsoleLogPublisher, or nothing published yet). */
  container: ContainerStatus | null;
  note?: string;
}

/**
 * "Atualizar status": re-reads the row and, when a real Graph publisher is registered and the row
 * carries an externalId, asks Meta what it currently thinks. Read-only — it never publishes.
 */
export async function refreshPublicationStatus(publicationId: string, options: { publisher?: Publisher } = {}): Promise<RefreshStatusResult> {
  const publication = await publicationRepo.findById(publicationId);
  if (!publication) throw new Error(`refreshPublicationStatus: SocialPublication "${publicationId}" nao encontrada.`);

  const publisher = options.publisher ?? getPublisher(publication.network.toLowerCase());
  const status = publication.status as PublicationStatus;

  if (!(publisher instanceof InstagramGraphPublisher)) {
    return {
      publicationId,
      status,
      externalId: publication.externalId,
      container: null,
      note: "Nenhum publisher real registrado para esta rede — status reflete apenas o fluxo interno."
    };
  }

  if (!publication.externalId) {
    return { publicationId, status, externalId: null, container: null, note: "Publicacao ainda nao tem id externo na Meta." };
  }

  const container = await publisher.getContainerStatus(publication.externalId);

  await recordHistory({
    action: "PUBLISH_ATTEMPTED",
    contentId: publication.contentId,
    publicationId,
    detail: { refreshOnly: true, statusCode: container.statusCode }
  }).catch(() => undefined);

  return { publicationId, status, externalId: publication.externalId, container };
}

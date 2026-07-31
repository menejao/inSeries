import { historyRepo } from "../db/history-repo";
import { logger } from "../logger";
import type { SocialAutomationAction } from "@prisma/client";

export type HistoryEvent = {
  action: SocialAutomationAction;
  contentId?: string | null;
  publicationId?: string | null;
  detail?: Record<string, unknown>;
};

/**
 * Every module in this package MUST call `recordHistory` for every action it
 * takes (generate/render/media/publish/error/retry) — nothing is silent.
 * Writes both a persistent SocialAutomationHistory row (source of truth,
 * queryable) and a structured log line (operational visibility). If the DB
 * write fails (e.g. no live DB in this sandbox), the failure is logged loudly
 * rather than swallowed — the caller decides whether that's fatal.
 */
export async function recordHistory(event: HistoryEvent): Promise<void> {
  logger.info(`history:${event.action}`, {
    module: "history",
    metadata: { contentId: event.contentId, publicationId: event.publicationId, detail: event.detail }
  });

  try {
    await historyRepo.record({
      action: event.action,
      contentId: event.contentId ?? null,
      publicationId: event.publicationId ?? null,
      detail: event.detail ?? null
    });
  } catch (error) {
    logger.error("history:persist-failed", {
      module: "history",
      metadata: { action: event.action, contentId: event.contentId, publicationId: event.publicationId, error: String(error) }
    });
    throw error;
  }
}

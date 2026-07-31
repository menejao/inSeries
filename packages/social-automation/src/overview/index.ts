import { contentRepo } from "../db/content-repo";
import { publicationRepo } from "../db/publication-repo";
import { historyRepo } from "../db/history-repo";
import { getAutomationPauseState, type AutomationPauseState } from "../settings";
import { listNetworkPublisherStatuses, noNetworkIsConfigured, type NetworkPublisherStatus } from "../publisher/status";
import { computeNextRun } from "../scheduler";
import { formatForDate } from "../content-engine/editorial-calendar";
import { socialAutomationConfig } from "../config";
import type { SocialContentStatus, SocialPublicationStatus } from "@prisma/client";
import type { ListHistoryItem } from "../db/history-repo";

/**
 * INSERIES-SOCIAL-ADMIN-PANEL-03 — a single read-only aggregate for the panel's overview screen.
 * Pure composition of functions that already existed (repos + scheduler + editorial-calendar +
 * publisher status + settings); it computes nothing new, it just fetches them together so the
 * page component stays a dumb renderer with one await.
 */
export interface SocialOverview {
  contentCounts: Record<SocialContentStatus, number>;
  publicationCounts: Record<SocialPublicationStatus, number>;
  /** Next slot per scheduler.computeNextRun + which format the editorial calendar assigns to it. */
  nextRun: { at: Date; format: string };
  scheduleTimes: string[];
  mode: string;
  environment: string;
  pauseState: AutomationPauseState;
  networks: NetworkPublisherStatus[];
  anyNetworkConfigured: boolean;
  recentHistory: ListHistoryItem[];
  pendingReviewCount: number;
}

export async function getSocialOverview(now: Date = new Date()): Promise<SocialOverview> {
  const [contentCounts, publicationCounts, pauseState, history] = await Promise.all([
    contentRepo.countsByStatus(),
    publicationRepo.countsByStatus(),
    getAutomationPauseState(),
    historyRepo.listPaginated({ page: 1, perPage: 10 })
  ]);

  const nextRunAt = computeNextRun(now);

  return {
    contentCounts,
    publicationCounts,
    nextRun: { at: nextRunAt, format: formatForDate(nextRunAt) },
    scheduleTimes: socialAutomationConfig.scheduleTimes,
    mode: socialAutomationConfig.mode,
    environment: socialAutomationConfig.environment,
    pauseState,
    networks: listNetworkPublisherStatuses(),
    anyNetworkConfigured: !noNetworkIsConfigured(),
    recentHistory: history.items,
    pendingReviewCount: contentCounts.DRAFT + contentCounts.PENDING_APPROVAL
  };
}

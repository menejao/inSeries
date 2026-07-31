import { socialAutomationConfig } from "../config";
import { publicationRepo } from "../db/publication-repo";
import { recordHistory } from "../history";
import type { SocialPublication } from "@prisma/client";

/**
 * Real, unit-testable scheduling logic — computes when the next post should
 * run given the configured daily HH:mm times. NOT wired to any actual cron
 * or job runner (same "documented, not executed" pattern as
 * lib/jobs/registry.ts's futureCatalogSyncJobs). A future cron trigger would
 * call getDuePublications() on an interval and hand results to the
 * content-engine — that wiring doesn't exist yet.
 */

/** Parses "HH:mm" against a reference date, returning the same-day Date. */
function timeOnDate(time: string, reference: Date): Date {
  const [hours, minutes] = time.split(":").map(Number);
  const result = new Date(reference);
  result.setHours(hours, minutes, 0, 0);
  return result;
}

/**
 * Given the configured schedule times and a reference "now", returns the
 * next Date (today or tomorrow) that a post should go out.
 */
export function computeNextRun(now: Date = new Date(), scheduleTimes: string[] = socialAutomationConfig.scheduleTimes): Date {
  if (scheduleTimes.length === 0) {
    throw new Error("computeNextRun: no schedule times configured");
  }

  const candidatesToday = scheduleTimes.map((time) => timeOnDate(time, now)).sort((a, b) => a.getTime() - b.getTime());

  const nextToday = candidatesToday.find((candidate) => candidate.getTime() > now.getTime());
  if (nextToday) return nextToday;

  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const earliestTime = [...scheduleTimes].sort()[0];
  return timeOnDate(earliestTime, tomorrow);
}

/** Publications that are due to go out now (scheduledFor <= now, still PENDING/SCHEDULED). */
export async function getDuePublications(now: Date = new Date()): Promise<SocialPublication[]> {
  return publicationRepo.listDue(now);
}

/**
 * Marks a publication's next scheduled run and records the decision to
 * history. Does not itself trigger publishing — that's the content-engine's
 * job when the (not-yet-wired) automatic runner calls it.
 */
export async function scheduleNext(publicationId: string, now: Date = new Date()): Promise<Date> {
  const nextRun = computeNextRun(now);

  await recordHistory({
    action: "RETRY_SCHEDULED",
    publicationId,
    detail: { nextRun: nextRun.toISOString() }
  });

  return nextRun;
}

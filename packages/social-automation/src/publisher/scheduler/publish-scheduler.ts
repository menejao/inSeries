/**
 * INSERIES-INSTAGRAM-PUBLISHER-05 — "publicar agora" vs "publicar em data futura".
 *
 * Pure decision functions, no I/O: everything here is a `Date` in/`Date` out so it is trivially
 * testable. All comparisons are absolute-time comparisons on UTC instants — a JS `Date` IS a UTC
 * instant, so the rule this module enforces is simply "never build a Date from local-time parts".
 * Formatting to the operator's timezone belongs to the admin UI (`social-shared.tsx`), never here.
 *
 * The package already has a `scheduler/` module (`computeNextRun`, `getDuePublications`) for the
 * editorial calendar. This one is deliberately separate and narrower: it answers only "should this
 * specific publication go out right now?".
 */
import type { PublicationStatus } from "../types";
import { CANCELLABLE_STATUSES, IN_FLIGHT_STATUSES, TERMINAL_STATUSES } from "../types";

/** Tolerance so a slot one second in the future is not pointlessly deferred. */
export const DUE_TOLERANCE_MS = 1_000;

export type ScheduleDecision =
  | { action: "publish-now"; reason: "due" | "immediate" }
  | { action: "defer"; reason: "future"; dueInMs: number }
  | { action: "skip"; reason: "terminal" | "in-flight" | "cancelled" };

export interface SchedulablePublication {
  id: string;
  status: PublicationStatus;
  scheduledFor: Date;
}

/** An ISO-8601 string is parsed as an absolute instant — the only safe way to build a UTC Date. */
export function parseInstant(value: string | Date): Date {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Data invalida para agendamento: "${String(value)}".`);
  }
  return date;
}

export function isDue(scheduledFor: Date, now: Date = new Date()): boolean {
  return scheduledFor.getTime() - now.getTime() <= DUE_TOLERANCE_MS;
}

export function isFuture(scheduledFor: Date, now: Date = new Date()): boolean {
  return !isDue(scheduledFor, now);
}

/**
 * The single scheduling rule. `force` is the admin panel's explicit "Publicar agora" button: it
 * overrides a future slot, but never overrides a terminal or in-flight status — a published or
 * cancelled row is never republished, and a row mid-upload is never touched.
 */
export function decide(publication: SchedulablePublication, now: Date = new Date(), options: { force?: boolean } = {}): ScheduleDecision {
  if (publication.status === "CANCELLED") return { action: "skip", reason: "cancelled" };
  if (TERMINAL_STATUSES.includes(publication.status)) return { action: "skip", reason: "terminal" };
  if (IN_FLIGHT_STATUSES.includes(publication.status)) return { action: "skip", reason: "in-flight" };

  if (options.force) return { action: "publish-now", reason: "immediate" };
  if (isDue(publication.scheduledFor, now)) return { action: "publish-now", reason: "due" };

  return { action: "defer", reason: "future", dueInMs: publication.scheduledFor.getTime() - now.getTime() };
}

/** Whether the "Cancelar" action is legal for a status. Mirrors CANCELLABLE_STATUSES. */
export function canCancel(status: PublicationStatus): boolean {
  return CANCELLABLE_STATUSES.includes(status);
}

/** Publications whose slot has arrived, oldest first. Pure — the caller supplies the rows. */
export function selectDue(publications: SchedulablePublication[], now: Date = new Date()): SchedulablePublication[] {
  return publications
    .filter((publication) => decide(publication, now).action === "publish-now")
    .sort((a, b) => a.scheduledFor.getTime() - b.scheduledFor.getTime());
}

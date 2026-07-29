import { config } from "@/lib/config";
import { isFeatureEnabled } from "@/lib/config/flags";

/** "MM-DD" -> {month (1-12), day}. */
function parseMonthDay(value: string): { month: number; day: number } {
  const [month, day] = value.split("-").map(Number);
  return { month, day };
}

function toComparable(month: number, day: number): number {
  return month * 100 + day;
}

/**
 * INSERIES-RECAP-ENGINE-01 — "acontece apenas uma vez por ano... disponibilizado
 * automaticamente durante o periodo definido pelo sistema." The window is expressed as
 * "MM-DD" boundaries (config.recapWrapped.windowStart/windowEnd) and is allowed to wrap the
 * year boundary — the default (Dec 1 -> Jan 31) is exactly that case, since a Wrapped for
 * year X is meant to still be viewable into January of X+1.
 */
export function isRecapWindowOpen(now: Date = new Date()): boolean {
  const start = parseMonthDay(config.recapWrapped.windowStart);
  const end = parseMonthDay(config.recapWrapped.windowEnd);
  const today = toComparable(now.getUTCMonth() + 1, now.getUTCDate());
  const startValue = toComparable(start.month, start.day);
  const endValue = toComparable(end.month, end.day);

  if (startValue <= endValue) {
    return today >= startValue && today <= endValue;
  }
  // Wraps the year boundary (e.g. Dec 1 -> Jan 31): open if today is on/after start OR on/before end.
  return today >= startValue || today <= endValue;
}

/**
 * The year being recapped. During the window, this is "the year that just ended" once we've
 * crossed into the new year — e.g. in January 2027 (within a Dec-Jan window) the Wrapped is
 * still for 2026, not 2027. Outside the window (admin preview), falls back to the same rule
 * so a preview always shows a sensible year rather than the current, likely-incomplete one.
 */
export function getRecapYear(now: Date = new Date()): number {
  const currentYear = now.getUTCFullYear();
  const start = parseMonthDay(config.recapWrapped.windowStart);
  // If the window wraps the year boundary and we're already past Jan 1st but still before the
  // window's end (i.e. we're in the "January tail"), the recapped year is the previous one.
  const isInJanuaryTail = start.month === 12 && now.getUTCMonth() + 1 <= parseMonthDay(config.recapWrapped.windowEnd).month;
  return isInJanuaryTail ? currentYear - 1 : currentYear;
}

/** True for admins (always) or any user during the official window — the single gate every route/nav entry should check. */
export function canAccessRecapWrapped(isAdmin: boolean, now: Date = new Date()): boolean {
  if (!isFeatureEnabled("recapWrapped")) return false;
  return isAdmin || isRecapWindowOpen(now);
}

/** True when access is only possible because the caller is an admin outside the official window — drives the "Modo Preview" banner. */
export function isRecapPreviewMode(isAdmin: boolean, now: Date = new Date()): boolean {
  return isAdmin && !isRecapWindowOpen(now);
}

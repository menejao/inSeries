import { contentEngineConfig, WEEKDAY_KEYS, type ContentFormatKey, type WeekdayKey } from "../config";

const WEEKDAY_INDEX_TO_KEY: WeekdayKey[] = [...WEEKDAY_KEYS]; // Date#getDay(): 0=Sun..6=Sat, matches WEEKDAY_KEYS order

export function weekdayKeyFor(date: Date): WeekdayKey {
  return WEEKDAY_INDEX_TO_KEY[date.getDay()];
}

/** Weekday -> format, sourced from config (zod-parsed env or pt-BR default), never a hardcoded switch. */
export function formatForDate(date: Date): ContentFormatKey {
  return contentEngineConfig.editorialCalendar[weekdayKeyFor(date)];
}

/** Whether the calendar explicitly schedules the same format on `date` and the day before it (e.g. themed-list on fri+sat by default) — repetition-guard uses this to allow that specific, intentional repeat. */
export function calendarExplicitlyRepeats(date: Date): boolean {
  const yesterday = new Date(date);
  yesterday.setDate(yesterday.getDate() - 1);
  return formatForDate(date) === formatForDate(yesterday);
}

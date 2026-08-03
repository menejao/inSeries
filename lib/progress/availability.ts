import { getDefaultTimezone } from "@/lib/config";

/**
 * INSERIES-WATCH-NEXT-AVAILABILITY-01 — the single definition of "available episode" every
 * progress/status/watch-next calculation must use.
 *
 * TMDb only ever gives us a bare `air_date` ("YYYY-MM-DD", no time) — lib/catalog/repository.ts
 * stores it as `new Date("YYYY-MM-DD")`, which JS parses as UTC midnight of that date. Comparing
 * that raw timestamp against `now` (the old `airedAt <= now` rule) made an episode "available"
 * the instant UTC midnight passed, which for timezones behind UTC (e.g. America/Sao_Paulo,
 * UTC-3) is still the *previous* local day, hours before any real broadcast could plausibly have
 * happened. `resolveEpisodeAvailability` fixes this: a date-only `airedAt` only becomes
 * AVAILABLE at local midnight of the day *after* the air date, in the given IANA timezone — never
 * during the premiere day itself.
 */
export type EpisodeAvailabilityStatus = "AVAILABLE" | "TODAY_PENDING" | "FUTURE";

export interface EpisodeAvailabilityInput {
  /** Release instant, straight from Episode.airedAt. Null = not yet scheduled/synced -> FUTURE. */
  airedAt: Date | null;
}

export interface EpisodeAvailabilityResult {
  status: EpisodeAvailabilityStatus;
  /**
   * The real-time instant the episode becomes AVAILABLE. Null only when `airedAt` itself is
   * null (nothing to compute from yet). Always a concrete instant otherwise — useful for UI
   * countdowns ("disponível às 00:00").
   */
  availableAt: Date | null;
}

/**
 * `airedAt` values synced from TMDb are always exact UTC midnight (constructed from a bare date
 * string — see module doc). A *real* release timestamp landing on that exact millisecond is
 * astronomically unlikely, so "does this Date have a non-zero UTC time-of-day" is a safe,
 * dependency-free way to distinguish "we know the real release instant" from "we only know the
 * calendar day" without adding a second field to the Episode model.
 */
function hasReliableTime(date: Date): boolean {
  return (
    date.getUTCHours() !== 0 || date.getUTCMinutes() !== 0 || date.getUTCSeconds() !== 0 || date.getUTCMilliseconds() !== 0
  );
}

interface ZonedParts {
  year: number;
  month: number; // 1-12
  day: number;
  hour: number;
  minute: number;
  second: number;
}

const partsFormatterCache = new Map<string, Intl.DateTimeFormat>();

function getPartsFormatter(timezone: string): Intl.DateTimeFormat {
  let formatter = partsFormatterCache.get(timezone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      hour12: false,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
    });
    partsFormatterCache.set(timezone, formatter);
  }
  return formatter;
}

/** The calendar date/time this instant reads as in `timezone` — e.g. midnight UTC read in America/Sao_Paulo is still the previous local day, 21:00. */
function getZonedParts(instant: Date, timezone: string): ZonedParts {
  const parts = getPartsFormatter(timezone).formatToParts(instant);
  const lookup: Record<string, string> = {};
  for (const part of parts) {
    if (part.type !== "literal") lookup[part.type] = part.value;
  }
  return {
    year: Number(lookup.year),
    month: Number(lookup.month),
    day: Number(lookup.day),
    // Intl reports midnight as "24" with hour12:false in some engines — normalize to 0.
    hour: Number(lookup.hour) % 24,
    minute: Number(lookup.minute),
    second: Number(lookup.second)
  };
}

/**
 * Converts a local wall-clock time in `timezone` (e.g. "2026-08-04 00:00:00 in America/Sao_Paulo")
 * to the real UTC instant it represents — DST-safe. Standard two-pass approximation: guess the
 * instant as if the wall-clock were UTC, measure how far that guess actually reads in the target
 * timezone, and correct by the difference. Converges after one correction for every real-world
 * IANA zone (offsets change by whole minutes, never by more than a day).
 */
function zonedTimeToInstant(year: number, month: number, day: number, hour: number, minute: number, second: number, timezone: string): Date {
  let guess = Date.UTC(year, month - 1, day, hour, minute, second);

  for (let i = 0; i < 2; i++) {
    const readBack = getZonedParts(new Date(guess), timezone);
    const readBackAsUtc = Date.UTC(readBack.year, readBack.month - 1, readBack.day, readBack.hour, readBack.minute, readBack.second);
    const drift = readBackAsUtc - Date.UTC(year, month - 1, day, hour, minute, second);
    if (drift === 0) break;
    guess -= drift;
  }

  return new Date(guess);
}

/** Local midnight of the day *after* `instant`'s local calendar day, in `timezone`, as a real UTC instant. */
function nextLocalMidnight(instant: Date, timezone: string): Date {
  const local = getZonedParts(instant, timezone);
  // Date.UTC normalizes an out-of-range day (e.g. 32) into the next month correctly — no manual
  // month-length/leap-year handling needed.
  return zonedTimeToInstant(local.year, local.month, local.day + 1, 0, 0, 0, timezone);
}

function localDateKey(instant: Date, timezone: string): string {
  const { year, month, day } = getZonedParts(instant, timezone);
  return `${year}-${month}-${day}`;
}

/**
 * The single source of truth for "can this episode be watched right now": used by watch-next,
 * the "mark as watched" gate (lib/progress/mutations.ts, via isEpisodeAvailable below), and
 * progress percentage (lib/progress/calculate.ts).
 *
 * - `airedAt` null -> FUTURE, availableAt null (nothing synced yet).
 * - `airedAt` carries a real time-of-day (see `hasReliableTime`) -> AVAILABLE the instant
 *   `now >= airedAt`, full timestamp comparison, no day-rounding.
 * - `airedAt` is date-only (the TMDb-synced common case) -> AVAILABLE only from local midnight
 *   of the day *after* the air date, in `timezone`. Never available during the premiere day
 *   itself, however early `now` already crossed the UTC-midnight instant.
 * - Not yet AVAILABLE but the air date is today in `timezone` -> TODAY_PENDING ("estreia hoje").
 * - Otherwise -> FUTURE.
 */
export function resolveEpisodeAvailability(
  episode: EpisodeAvailabilityInput,
  now: Date = new Date(),
  timezone: string = getDefaultTimezone()
): EpisodeAvailabilityResult {
  const { airedAt } = episode;

  if (airedAt === null) {
    return { status: "FUTURE", availableAt: null };
  }

  const availableAt = hasReliableTime(airedAt) ? airedAt : nextLocalMidnight(airedAt, timezone);

  if (now.getTime() >= availableAt.getTime()) {
    return { status: "AVAILABLE", availableAt };
  }

  const isPremiereDay = localDateKey(now, timezone) === localDateKey(airedAt, timezone);
  return { status: isPremiereDay ? "TODAY_PENDING" : "FUTURE", availableAt };
}

/**
 * Boolean convenience wrapper kept for every existing call site (lib/progress/calculate.ts,
 * lib/progress/mutations.ts) — `true` iff `resolveEpisodeAvailability(...).status === "AVAILABLE"`.
 * A TODAY_PENDING episode (aired today, no reliable release time yet) is *not* available: it
 * can't be marked watched and doesn't count toward progress, same as a FUTURE episode.
 */
export function isEpisodeAvailable(airedAt: Date | null, now: Date = new Date(), timezone: string = getDefaultTimezone()): boolean {
  return resolveEpisodeAvailability({ airedAt }, now, timezone).status === "AVAILABLE";
}

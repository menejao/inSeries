import { z } from "zod";

/**
 * Single source of truth for this package's configuration. Nothing else in
 * packages/social-automation should read `process.env` directly — mirrors the
 * pattern in lib/config/index.ts from the main app.
 *
 * `environment` is deliberately distinct from the main app's NODE_ENV: this
 * package can run in "homologation" (a real DB, fake network calls) as a
 * rehearsal stage before "production" (where a real Publisher could one day
 * actually post). "development" always no-ops actual publishing, regardless
 * of which Publisher is registered — see publisher/registry.ts.
 */
const ENVIRONMENTS = ["development", "homologation", "production"] as const;
export type SocialAutomationEnvironment = (typeof ENVIRONMENTS)[number];

const MODES = ["manual", "automatic"] as const;
export type SocialAutomationMode = (typeof MODES)[number];

const NETWORKS = ["instagram"] as const;
export type SocialNetworkKey = (typeof NETWORKS)[number];

const optionalNonEmpty = () => z.preprocess((value) => (value === "" ? undefined : value), z.string().optional());

const envSchema = z.object({
  SOCIAL_AUTOMATION_ENVIRONMENT: optionalNonEmpty(),
  SOCIAL_AUTOMATION_MODE: optionalNonEmpty(),
  SOCIAL_AUTOMATION_SCHEDULE_TIMES: optionalNonEmpty(),
  SOCIAL_AUTOMATION_DAILY_POST_COUNT: optionalNonEmpty(),
  SOCIAL_AUTOMATION_ENABLED_NETWORKS: optionalNonEmpty(),
  SOCIAL_AUTOMATION_LOG_LEVEL: optionalNonEmpty()
});

const rawEnv = envSchema.safeParse(process.env).success
  ? envSchema.parse(process.env)
  : ({} as z.infer<typeof envSchema>);

function parseEnvironment(value: string | undefined): SocialAutomationEnvironment {
  return (ENVIRONMENTS as readonly string[]).includes(value ?? "") ? (value as SocialAutomationEnvironment) : "development";
}

function parseMode(value: string | undefined): SocialAutomationMode {
  return (MODES as readonly string[]).includes(value ?? "") ? (value as SocialAutomationMode) : "manual";
}

/** "09:00,18:30" -> ["09:00", "18:30"], validated HH:mm, deduped, sorted. */
function parseScheduleTimes(value: string | undefined): string[] {
  const fallback = ["09:00"];
  if (!value) return fallback;
  const times = value
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => /^([01]\d|2[0-3]):[0-5]\d$/.test(entry));
  if (times.length === 0) return fallback;
  return Array.from(new Set(times)).sort();
}

function parseEnabledNetworks(value: string | undefined): SocialNetworkKey[] {
  const fallback: SocialNetworkKey[] = ["instagram"];
  if (!value) return fallback;
  const networks = value
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter((entry): entry is SocialNetworkKey => (NETWORKS as readonly string[]).includes(entry));
  return networks.length > 0 ? Array.from(new Set(networks)) : fallback;
}

function parseDailyPostCount(value: string | undefined): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 1;
}

// ---------------------------------------------------------------------------
// INSERIES-SOCIAL-CONTENT-ENGINE-02 — content-engine specific config. Same
// zod/env-prefix pattern as above; anything not naturally an env var (theme
// maps, poll question banks, banned-word lists) lives as static seed data
// inside its own content-engine/* module instead, per the ticket's guidance,
// but is still structurally overridable there (arrays/objects, not magic
// numbers buried in logic).
// ---------------------------------------------------------------------------

const FORMAT_KEYS = [
  "series-of-the-day",
  "similar-series",
  "trending",
  "weekly-premieres",
  "ranking",
  "poll",
  "themed-list",
  "inseries-feature"
] as const;
export type ContentFormatKey = (typeof FORMAT_KEYS)[number];

const WEEKDAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;
export type WeekdayKey = (typeof WEEKDAYS)[number];

/** Default pt-BR editorial calendar per the ticket. Overridable via SOCIAL_AUTOMATION_EDITORIAL_CALENDAR. */
const DEFAULT_EDITORIAL_CALENDAR: Record<WeekdayKey, ContentFormatKey> = {
  mon: "weekly-premieres",
  tue: "similar-series",
  wed: "trending",
  thu: "poll",
  fri: "themed-list",
  sat: "themed-list",
  sun: "inseries-feature"
};

/** "mon:weekly-premieres,tue:similar-series,..." -> Record<WeekdayKey, ContentFormatKey>, falling back per-day to the default. */
function parseEditorialCalendar(value: string | undefined): Record<WeekdayKey, ContentFormatKey> {
  const result: Record<WeekdayKey, ContentFormatKey> = { ...DEFAULT_EDITORIAL_CALENDAR };
  if (!value) return result;
  for (const entry of value.split(",")) {
    const [day, format] = entry.split(":").map((part) => part.trim().toLowerCase());
    if ((WEEKDAYS as readonly string[]).includes(day) && (FORMAT_KEYS as readonly string[]).includes(format)) {
      result[day as WeekdayKey] = format as ContentFormatKey;
    }
  }
  return result;
}

function parsePositiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

function parseFloatWithFallback(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

const contentEngineEnvSchema = z.object({
  SOCIAL_AUTOMATION_EDITORIAL_CALENDAR: optionalNonEmpty(),
  SOCIAL_AUTOMATION_POSTS_PER_DAY: optionalNonEmpty(),
  SOCIAL_AUTOMATION_REPETITION_INTERVAL_DAYS: optionalNonEmpty(),
  SOCIAL_AUTOMATION_MIN_RATING: optionalNonEmpty(),
  SOCIAL_AUTOMATION_MIN_VOTES: optionalNonEmpty(),
  SOCIAL_AUTOMATION_RECOMMENDATIONS_PER_POST: optionalNonEmpty(),
  SOCIAL_AUTOMATION_LANGUAGE: optionalNonEmpty(),
  SOCIAL_AUTOMATION_REGION: optionalNonEmpty(),
  SOCIAL_AUTOMATION_REQUIRE_APPROVAL: optionalNonEmpty(),
  SOCIAL_AUTOMATION_MIN_POPULARITY: optionalNonEmpty(),
  SOCIAL_AUTOMATION_TRENDING_MAX_AGE_YEARS: optionalNonEmpty(),
  SOCIAL_AUTOMATION_CAPTION_MAX_LENGTH: optionalNonEmpty()
});

const rawContentEngineEnv = contentEngineEnvSchema.safeParse(process.env).success
  ? contentEngineEnvSchema.parse(process.env)
  : ({} as z.infer<typeof contentEngineEnvSchema>);

export const contentEngineConfig = {
  editorialCalendar: parseEditorialCalendar(rawContentEngineEnv.SOCIAL_AUTOMATION_EDITORIAL_CALENDAR),
  postsPerDay: parsePositiveInt(rawContentEngineEnv.SOCIAL_AUTOMATION_POSTS_PER_DAY, 1),
  repetitionIntervalDays: parsePositiveInt(rawContentEngineEnv.SOCIAL_AUTOMATION_REPETITION_INTERVAL_DAYS, 30),
  minRating: parseFloatWithFallback(rawContentEngineEnv.SOCIAL_AUTOMATION_MIN_RATING, 0),
  minVotes: parsePositiveInt(rawContentEngineEnv.SOCIAL_AUTOMATION_MIN_VOTES, 0) === 0 ? 0 : parsePositiveInt(rawContentEngineEnv.SOCIAL_AUTOMATION_MIN_VOTES, 0),
  minPopularity: parseFloatWithFallback(rawContentEngineEnv.SOCIAL_AUTOMATION_MIN_POPULARITY, 0),
  trendingMaxAgeYears: parsePositiveInt(rawContentEngineEnv.SOCIAL_AUTOMATION_TRENDING_MAX_AGE_YEARS, 15),
  recommendationsPerPost: parsePositiveInt(rawContentEngineEnv.SOCIAL_AUTOMATION_RECOMMENDATIONS_PER_POST, 4),
  language: rawContentEngineEnv.SOCIAL_AUTOMATION_LANGUAGE ?? "pt-BR",
  region: rawContentEngineEnv.SOCIAL_AUTOMATION_REGION ?? "BR",
  captionMaxLength: parsePositiveInt(rawContentEngineEnv.SOCIAL_AUTOMATION_CAPTION_MAX_LENGTH, 2200),
  /**
   * Approval is mandatory in this ticket's design — editorial-safety.ts never auto-approves
   * generated content, and approval.ts is the only path DRAFT/PENDING_APPROVAL -> APPROVED can
   * take. SOCIAL_AUTOMATION_REQUIRE_APPROVAL is intentionally NOT read from env: `false` is
   * unsupported (there is no auto-publish path in this package), so this always resolves true.
   */
  requireApproval: true as const
};

export type ContentEngineConfig = typeof contentEngineConfig;

export const CONTENT_FORMAT_KEYS = FORMAT_KEYS;
export const WEEKDAY_KEYS = WEEKDAYS;

export const socialAutomationConfig = {
  environment: parseEnvironment(rawEnv.SOCIAL_AUTOMATION_ENVIRONMENT),
  mode: parseMode(rawEnv.SOCIAL_AUTOMATION_MODE),
  scheduleTimes: parseScheduleTimes(rawEnv.SOCIAL_AUTOMATION_SCHEDULE_TIMES),
  dailyPostCount: parseDailyPostCount(rawEnv.SOCIAL_AUTOMATION_DAILY_POST_COUNT),
  enabledNetworks: parseEnabledNetworks(rawEnv.SOCIAL_AUTOMATION_ENABLED_NETWORKS),
  logLevel: (rawEnv.SOCIAL_AUTOMATION_LOG_LEVEL ?? "info") as "debug" | "info" | "warn" | "error",
  contentEngine: contentEngineConfig
};

export type SocialAutomationConfig = typeof socialAutomationConfig;

// ---------------------------------------------------------------------------
// INSERIES-INSTAGRAM-PUBLISHER-05 — Meta Graph API credentials/tuning.
//
// These are the ONLY place the package reads Meta credentials from. They are
// never persisted to the database and never logged: `publisher/utils/mask.ts`
// masks any value before it can reach a log line, and `describeMetaConfig()`
// below is what the admin Configuracoes screen reads (booleans/lengths only,
// never the value itself).
// ---------------------------------------------------------------------------

const metaEnvSchema = z.object({
  INSTAGRAM_BUSINESS_ACCOUNT_ID: optionalNonEmpty(),
  FACEBOOK_PAGE_ID: optionalNonEmpty(),
  META_APP_ID: optionalNonEmpty(),
  META_APP_SECRET: optionalNonEmpty(),
  META_ACCESS_TOKEN: optionalNonEmpty(),
  META_API_VERSION: optionalNonEmpty(),
  META_REQUEST_TIMEOUT_MS: optionalNonEmpty(),
  META_RETRY_LIMIT: optionalNonEmpty(),
  SOCIAL_AUTOMATION_PUBLIC_MEDIA_BASE_URL: optionalNonEmpty()
});

const rawMetaEnv = metaEnvSchema.safeParse(process.env).success
  ? metaEnvSchema.parse(process.env)
  : ({} as z.infer<typeof metaEnvSchema>);

/** Graph API version must look like "v21.0" — a malformed value would silently 404 every call. */
function parseApiVersion(value: string | undefined): string {
  return value && /^v\d+\.\d+$/.test(value) ? value : "v21.0";
}

/** Trailing slash stripped so callers can always do `${base}/${path}`. */
function parseBaseUrl(value: string | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim().replace(/\/+$/, "");
  return /^https:\/\/.+/.test(trimmed) ? trimmed : null;
}

export const metaConfig = {
  instagramBusinessAccountId: rawMetaEnv.INSTAGRAM_BUSINESS_ACCOUNT_ID ?? null,
  facebookPageId: rawMetaEnv.FACEBOOK_PAGE_ID ?? null,
  appId: rawMetaEnv.META_APP_ID ?? null,
  appSecret: rawMetaEnv.META_APP_SECRET ?? null,
  accessToken: rawMetaEnv.META_ACCESS_TOKEN ?? null,
  apiVersion: parseApiVersion(rawMetaEnv.META_API_VERSION),
  requestTimeoutMs: parsePositiveInt(rawMetaEnv.META_REQUEST_TIMEOUT_MS, 15_000),
  retryLimit: parsePositiveInt(rawMetaEnv.META_RETRY_LIMIT, 3),
  /**
   * Base URL the Meta Graph API can fetch the rendered PNGs from. `null` (the default) means
   * public media hosting is NOT configured — see publisher/instagram/image-hosting.ts and the
   * "Hospedagem de imagem" section of the package README for why this is an open infrastructure
   * gap rather than an invented storage service.
   */
  publicMediaBaseUrl: parseBaseUrl(rawMetaEnv.SOCIAL_AUTOMATION_PUBLIC_MEDIA_BASE_URL)
};

export type MetaConfig = typeof metaConfig;

/** Credentials without which no real Graph API call can possibly succeed. */
const REQUIRED_META_KEYS = ["instagramBusinessAccountId", "accessToken", "appId", "appSecret"] as const;

export function missingMetaCredentials(config: MetaConfig = metaConfig): string[] {
  const envVarByKey: Record<(typeof REQUIRED_META_KEYS)[number], string> = {
    instagramBusinessAccountId: "INSTAGRAM_BUSINESS_ACCOUNT_ID",
    accessToken: "META_ACCESS_TOKEN",
    appId: "META_APP_ID",
    appSecret: "META_APP_SECRET"
  };
  return REQUIRED_META_KEYS.filter((key) => !config[key]).map((key) => envVarByKey[key]);
}

/** True when every mandatory credential is present. Says nothing about the environment. */
export function hasMetaCredentials(config: MetaConfig = metaConfig): boolean {
  return missingMetaCredentials(config).length === 0;
}

/**
 * Fail-fast gate. In production (`isRealPublishAllowed()`) an incomplete Meta configuration must
 * throw early and loudly rather than let a half-configured publisher attempt a real post. Outside
 * production this is a no-op: dev/homologation never reach the real publisher (registry.ts keeps
 * ConsoleLogPublisher there).
 */
export function assertMetaConfigured(config: MetaConfig = metaConfig): void {
  if (!isRealPublishAllowed()) return;
  const missing = missingMetaCredentials(config);
  if (missing.length > 0) {
    throw new Error(
      `Publicacao real esta habilitada (SOCIAL_AUTOMATION_ENVIRONMENT=production) mas faltam credenciais da Meta Graph API: ${missing.join(", ")}.`
    );
  }
}

/** Credential-safe summary for the admin Configuracoes screen — never exposes a value. */
export function describeMetaConfig(config: MetaConfig = metaConfig) {
  return {
    apiVersion: config.apiVersion,
    requestTimeoutMs: config.requestTimeoutMs,
    retryLimit: config.retryLimit,
    hasCredentials: hasMetaCredentials(config),
    missingCredentials: missingMetaCredentials(config),
    publicMediaConfigured: Boolean(config.publicMediaBaseUrl)
  };
}

/** True only in "production" — every real-publish gate in the package must check this. */
export function isRealPublishAllowed(): boolean {
  return socialAutomationConfig.environment === "production";
}

export function isNetworkEnabled(network: string): boolean {
  return (socialAutomationConfig.enabledNetworks as string[]).includes(network.toLowerCase());
}

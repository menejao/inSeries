import { z } from "zod";
import packageJson from "@/package.json";

/**
 * Single point of truth for application configuration. `process.env` should
 * never be read directly outside this module (and the request-time exceptions
 * documented inline in session.ts/db/prisma.ts, which read secrets that must
 * never round-trip through the public config surface).
 */
// Blank env vars (e.g. `TMDB_API_KEY=""` left unset in .env) must behave like
// "not set", not like a validation failure — otherwise one blank optional var
// would fail the whole safeParse() and silently blank out every other field
// (including DATABASE_URL), which previously broke the /api/ready check.
const optionalNonEmpty = () => z.preprocess((value) => (value === "" ? undefined : value), z.string().optional());
const optionalUrl = () => z.preprocess((value) => (value === "" ? undefined : value), z.string().url().optional());

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).optional(),
  DATABASE_URL: optionalNonEmpty(),
  REDIS_URL: optionalNonEmpty(),
  AUTH_SECRET: optionalNonEmpty(),
  TMDB_API_KEY: optionalNonEmpty(),
  TMDB_ACCESS_TOKEN: optionalNonEmpty(),
  TMDB_BASE_URL: optionalUrl(),
  TMDB_LANGUAGE: optionalNonEmpty(),
  TMDB_POPULAR_PAGES: optionalNonEmpty(),
  TMDB_DISCOVER_PAGES: optionalNonEmpty(),
  TMDB_MAX_CONCURRENT_REQUESTS: optionalNonEmpty(),
  TMDB_REQUEST_DELAY_MS: optionalNonEmpty(),
  TMDB_MIN_VOTE_COUNT: optionalNonEmpty(),
  TMDB_MIN_YEAR: optionalNonEmpty(),
  TMDB_MAX_YEAR: optionalNonEmpty(),
  TMDB_PRIORITY_WEIGHT_POPULARITY: optionalNonEmpty(),
  TMDB_PRIORITY_WEIGHT_VOTE_COUNT: optionalNonEmpty(),
  TMDB_PRIORITY_WEIGHT_VOTE_AVERAGE: optionalNonEmpty(),
  TMDB_PRIORITY_ON_AIR_BONUS: optionalNonEmpty(),
  TMDB_PRIORITY_NEW_EPISODE_BONUS: optionalNonEmpty(),
  TMDB_COVERAGE_BATCH_SIZE: optionalNonEmpty(),
  NEXT_PUBLIC_APP_URL: optionalUrl(),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).optional(),
  RATE_LIMIT_ENABLED: optionalNonEmpty(),
  FEATURE_RECOMMENDATIONS: optionalNonEmpty(),
  FEATURE_TVTIME_IMPORT: optionalNonEmpty(),
  FEATURE_NOTIFICATIONS: optionalNonEmpty(),
  FEATURE_ADMIN_WORKSPACE: optionalNonEmpty(),
  FEATURE_CALENDAR: optionalNonEmpty(),
  FEATURE_REVIEWS: optionalNonEmpty(),
  FEATURE_LISTS: optionalNonEmpty(),
  FEATURE_FEED: optionalNonEmpty(),
  FEATURE_EXPERIMENTAL_SEARCH: optionalNonEmpty(),
  FEATURE_RECAP: optionalNonEmpty(),
  FEATURE_GAMIFICATION: optionalNonEmpty(),
  RECOMMENDATION_WEIGHT_GENRE: optionalNonEmpty(),
  RECOMMENDATION_WEIGHT_SIMILAR: optionalNonEmpty(),
  RECOMMENDATION_WEIGHT_POPULAR: optionalNonEmpty(),
  RECOMMENDATION_WEIGHT_RATING: optionalNonEmpty(),
  RECOMMENDATION_WEIGHT_TRENDING: optionalNonEmpty(),
  RECOMMENDATION_CANDIDATE_POOL_SIZE: optionalNonEmpty(),
  RECOMMENDATION_CACHE_TTL_SECONDS: optionalNonEmpty()
});

const parsedEnv = envSchema.safeParse(process.env);
const rawEnv = parsedEnv.success ? parsedEnv.data : {};

if (!parsedEnv.success) {
  // Never throw at import time (config is loaded on every request) — but a
  // silent full fallback to defaults is dangerous enough to surface loudly.
  console.error("[config] invalid environment variables, falling back to defaults:", parsedEnv.error.flatten().fieldErrors);
}

function parseBooleanFlag(value: string | undefined, fallback: boolean) {
  if (value === undefined) return fallback;
  return value === "1" || value.toLowerCase() === "true";
}

function parseNumberFlag(value: string | undefined, fallback: number) {
  if (value === undefined) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

/** Like parseNumberFlag, but has no fallback number — an unset/invalid value means "no filter". */
function parseOptionalNumberFlag(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

const nodeEnv = rawEnv.NODE_ENV ?? "development";
const tmdbApiKey = rawEnv.TMDB_API_KEY?.trim();
const tmdbAccessToken = rawEnv.TMDB_ACCESS_TOKEN?.trim();

export const config = {
  app: {
    name: "inSeries",
    version: packageJson.version,
    env: nodeEnv,
    isProduction: nodeEnv === "production"
  },
  urls: {
    appUrl: rawEnv.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"
  },
  auth: {
    secret: rawEnv.AUTH_SECRET ?? "dev-inseries-auth-secret-change-me",
    sessionTtlSeconds: 60 * 60 * 24 * 7,
    sessionCookieName: "inseries_session"
  },
  database: {
    url: rawEnv.DATABASE_URL
  },
  tmdb: {
    apiKey: tmdbApiKey,
    accessToken: tmdbAccessToken,
    baseUrl: rawEnv.TMDB_BASE_URL ?? "https://api.themoviedb.org/3",
    language: rawEnv.TMDB_LANGUAGE ?? "pt-BR",
    isConfigured: Boolean(tmdbApiKey || tmdbAccessToken)
  },
  /**
   * Fase 2/3/7 (INSERIES-TMDB-CATALOG-SCALE-01) — every knob the catalog sync pipeline
   * needs, all here (never a magic number inside lib/catalog/sync.ts or lib/tmdb/service.ts)
   * so tuning how much of the catalog gets pulled, how fast, and how strict the quality
   * bar is, never means hunting through the sync code itself.
   */
  catalogSync: {
    // ~20 series/page on TMDb's list endpoints, so pages=25 ~= 500 series (the ticket's own example).
    popularPages: parseNumberFlag(rawEnv.TMDB_POPULAR_PAGES, 1),
    discoverPages: parseNumberFlag(rawEnv.TMDB_DISCOVER_PAGES, 1),
    maxConcurrentRequests: Math.max(1, parseNumberFlag(rawEnv.TMDB_MAX_CONCURRENT_REQUESTS, 4)),
    requestDelayMs: parseNumberFlag(rawEnv.TMDB_REQUEST_DELAY_MS, 250),
    minVoteCount: parseNumberFlag(rawEnv.TMDB_MIN_VOTE_COUNT, 0),
    minYear: parseOptionalNumberFlag(rawEnv.TMDB_MIN_YEAR),
    maxYear: parseOptionalNumberFlag(rawEnv.TMDB_MAX_YEAR),
    // Fase 4 (INSERIES-TMDB-CATALOG-COVERAGE-01) — priority score = popularity*w + vote_count*w +
    // vote_average*w + bonuses. Bonuses come from which source(s) a candidate was found in (On The
    // Air/Airing Today already mean "currently airing"/"has an episode today"), never an extra TMDb call.
    priorityWeightPopularity: parseNumberFlag(rawEnv.TMDB_PRIORITY_WEIGHT_POPULARITY, 1),
    priorityWeightVoteCount: parseNumberFlag(rawEnv.TMDB_PRIORITY_WEIGHT_VOTE_COUNT, 0.01),
    priorityWeightVoteAverage: parseNumberFlag(rawEnv.TMDB_PRIORITY_WEIGHT_VOTE_AVERAGE, 5),
    priorityOnAirBonus: parseNumberFlag(rawEnv.TMDB_PRIORITY_ON_AIR_BONUS, 20),
    priorityNewEpisodeBonus: parseNumberFlag(rawEnv.TMDB_PRIORITY_NEW_EPISODE_BONUS, 10),
    // How many queue items syncCoverage processes between progress checkpoints (Fase 8 resume).
    coverageBatchSize: Math.max(1, parseNumberFlag(rawEnv.TMDB_COVERAGE_BATCH_SIZE, 25))
  },
  pagination: {
    defaultPageSize: 12,
    maxPageSize: 50
  },
  uploads: {
    // Not wired to any upload feature yet — reserved for future avatar/media uploads.
    maxSizeBytes: 5 * 1024 * 1024
  },
  notifications: {
    defaultListLimit: 30
  },
  pwa: {
    appName: "inSeries",
    themeColor: "#101828"
  },
  rateLimit: {
    enabled: parseBooleanFlag(rawEnv.RATE_LIMIT_ENABLED, false)
  },
  logging: {
    level: rawEnv.LOG_LEVEL ?? (nodeEnv === "production" ? "info" : "debug")
  },
  recommendations: {
    // Every provider's contribution is `providerScore * weight`, summed —
    // centralized here (instead of magic numbers inside each provider) so
    // tuning one signal's influence never means hunting through providers/.
    weights: {
      genre: parseNumberFlag(rawEnv.RECOMMENDATION_WEIGHT_GENRE, 1),
      similar: parseNumberFlag(rawEnv.RECOMMENDATION_WEIGHT_SIMILAR, 0.8),
      popular: parseNumberFlag(rawEnv.RECOMMENDATION_WEIGHT_POPULAR, 0.5),
      rating: parseNumberFlag(rawEnv.RECOMMENDATION_WEIGHT_RATING, 0.6),
      trending: parseNumberFlag(rawEnv.RECOMMENDATION_WEIGHT_TRENDING, 0.4)
    },
    candidatePoolSize: parseNumberFlag(rawEnv.RECOMMENDATION_CANDIDATE_POOL_SIZE, 200),
    cacheTtlSeconds: parseNumberFlag(rawEnv.RECOMMENDATION_CACHE_TTL_SECONDS, 300)
  },
  featureFlags: {
    // Was a placeholder (default off) before this sprint implemented the
    // engine — now a shipped, tested feature, so it defaults on like the
    // other complete features below (calendar/reviews/lists/feed).
    recommendations: parseBooleanFlag(rawEnv.FEATURE_RECOMMENDATIONS, true),
    tvtimeImport: parseBooleanFlag(rawEnv.FEATURE_TVTIME_IMPORT, false),
    notifications: parseBooleanFlag(rawEnv.FEATURE_NOTIFICATIONS, true),
    adminWorkspace: parseBooleanFlag(rawEnv.FEATURE_ADMIN_WORKSPACE, true),
    calendar: parseBooleanFlag(rawEnv.FEATURE_CALENDAR, true),
    reviews: parseBooleanFlag(rawEnv.FEATURE_REVIEWS, true),
    lists: parseBooleanFlag(rawEnv.FEATURE_LISTS, true),
    feed: parseBooleanFlag(rawEnv.FEATURE_FEED, true),
    experimentalSearch: parseBooleanFlag(rawEnv.FEATURE_EXPERIMENTAL_SEARCH, false),
    // Recap reuses the (already shipped, tested) Analytics Layer as its only
    // data source — same "ship it enabled" reasoning as recommendations above.
    recap: parseBooleanFlag(rawEnv.FEATURE_RECAP, true),
    // Same reasoning again: shipped and tested this sprint, defaults on.
    gamification: parseBooleanFlag(rawEnv.FEATURE_GAMIFICATION, true)
  }
};

export type AppConfig = typeof config;
export type FeatureFlag = keyof typeof config.featureFlags;

/** Backward-compatible helpers (previously in lib/env.ts) — kept so TMDb call sites don't re-read process.env. */
export function getTmdbCredentials() {
  return {
    apiKey: config.tmdb.apiKey,
    accessToken: config.tmdb.accessToken,
    isConfigured: config.tmdb.isConfigured
  };
}

export function getTmdbBaseUrl() {
  return config.tmdb.baseUrl;
}

export function getTmdbLanguage() {
  return config.tmdb.language;
}

/** Safe subset for exposure over HTTP/UI — never include secrets (auth.secret, database.url, tmdb keys). */
export function getPublicConfig() {
  return {
    app: config.app,
    urls: config.urls,
    pagination: config.pagination,
    featureFlags: config.featureFlags,
    rateLimit: config.rateLimit,
    recommendations: config.recommendations,
    tmdbConfigured: config.tmdb.isConfigured
  };
}

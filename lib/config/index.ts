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
  TMDB_QUALITY_WEIGHT_POPULARITY: optionalNonEmpty(),
  TMDB_QUALITY_WEIGHT_VOTE_AVERAGE: optionalNonEmpty(),
  TMDB_QUALITY_WEIGHT_VOTE_COUNT: optionalNonEmpty(),
  TMDB_QUALITY_WEIGHT_RECENCY: optionalNonEmpty(),
  TMDB_QUALITY_WEIGHT_STATUS: optionalNonEmpty(),
  TMDB_QUALITY_WEIGHT_SEASONS: optionalNonEmpty(),
  TMDB_QUALITY_WEIGHT_EPISODES: optionalNonEmpty(),
  TMDB_QUALITY_WEIGHT_BACKDROP: optionalNonEmpty(),
  TMDB_QUALITY_WEIGHT_POSTER: optionalNonEmpty(),
  TMDB_QUALITY_WEIGHT_OVERVIEW: optionalNonEmpty(),
  TMDB_QUALITY_WEIGHT_LOGO: optionalNonEmpty(),
  TMDB_QUALITY_WEIGHT_PROVIDERS: optionalNonEmpty(),
  TMDB_QUALITY_WEIGHT_ORIGIN_COUNTRY: optionalNonEmpty(),
  TMDB_QUALITY_WEIGHT_LANGUAGE: optionalNonEmpty(),
  TMDB_CURATION_ENABLED: optionalNonEmpty(),
  TMDB_MIN_VOTE_AVERAGE: optionalNonEmpty(),
  TMDB_CURATION_REQUIRE_IMAGE: optionalNonEmpty(),
  TMDB_CURATION_REQUIRE_OVERVIEW: optionalNonEmpty(),
  TMDB_CURATION_MAX_PILOT_AGE_DAYS: optionalNonEmpty(),
  TMDB_WATCH_PROVIDERS_REGION: optionalNonEmpty(),
  TMDB_TAG_MARATONA_MIN_EPISODES: optionalNonEmpty(),
  TMDB_TAG_MINISSERIE_MAX_EPISODES: optionalNonEmpty(),
  TMDB_TAG_PREMIADA_MIN_VOTE_AVERAGE: optionalNonEmpty(),
  TMDB_TAG_PREMIADA_MIN_VOTE_COUNT: optionalNonEmpty(),
  TMDB_TAG_EM_ALTA_MIN_POPULARITY: optionalNonEmpty(),
  TMDB_TAG_LONGA_DURACAO_MIN_SEASONS: optionalNonEmpty(),
  DISCOVERY_SOURCE_WEIGHT_TRENDING: optionalNonEmpty(),
  DISCOVERY_SOURCE_WEIGHT_ON_THE_AIR: optionalNonEmpty(),
  DISCOVERY_SOURCE_WEIGHT_POPULAR: optionalNonEmpty(),
  DISCOVERY_SOURCE_WEIGHT_TOP_RATED: optionalNonEmpty(),
  DISCOVERY_SOURCE_WEIGHT_DISCOVER: optionalNonEmpty(),
  DISCOVERY_STREAMING_PRIORITY_LIST: optionalNonEmpty(),
  DISCOVERY_BLACKLIST_ENABLED: optionalNonEmpty(),
  DISCOVERY_BLACKLIST_MIN_VOTE_COUNT: optionalNonEmpty(),
  DISCOVERY_BLACKLIST_MIN_VOTE_AVERAGE: optionalNonEmpty(),
  DISCOVERY_BLACKLIST_REQUIRE_POSTER: optionalNonEmpty(),
  DISCOVERY_BLACKLIST_REQUIRE_BACKDROP: optionalNonEmpty(),
  DISCOVERY_BLACKLIST_REQUIRE_OVERVIEW: optionalNonEmpty(),
  DISCOVERY_BLACKLIST_REQUIRE_EPISODES: optionalNonEmpty(),
  DISCOVERY_BLACKLIST_MAX_PILOT_AGE_DAYS: optionalNonEmpty(),
  DISCOVERY_SCORE_WEIGHT_TRENDING: optionalNonEmpty(),
  DISCOVERY_SCORE_WEIGHT_POPULARITY: optionalNonEmpty(),
  DISCOVERY_SCORE_WEIGHT_VOTE_AVERAGE: optionalNonEmpty(),
  DISCOVERY_SCORE_WEIGHT_VOTE_COUNT: optionalNonEmpty(),
  DISCOVERY_SCORE_WEIGHT_RECENCY: optionalNonEmpty(),
  DISCOVERY_SCORE_WEIGHT_STATUS: optionalNonEmpty(),
  DISCOVERY_SCORE_WEIGHT_PROVIDERS: optionalNonEmpty(),
  DISCOVERY_SCORE_WEIGHT_SEASONS: optionalNonEmpty(),
  DISCOVERY_SCORE_WEIGHT_EPISODES: optionalNonEmpty(),
  DISCOVERY_SCORE_WEIGHT_BACKDROP: optionalNonEmpty(),
  DISCOVERY_SCORE_WEIGHT_POSTER: optionalNonEmpty(),
  DISCOVERY_SCORE_WEIGHT_COLLECTION_TAGS: optionalNonEmpty(),
  DISCOVERY_SCORE_WEIGHT_QUALITY_SCORE: optionalNonEmpty(),
  DISCOVERY_ENGINE_MAX_CANDIDATES: optionalNonEmpty(),
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

function parseStringList(value: string | undefined, fallback: string[]): string[] {
  if (value === undefined) return fallback;
  const parsed = value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  return parsed.length ? parsed : fallback;
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
  /**
   * INSERIES-TMDB-CATALOG-QUALITY-01 — the editorial-quality layer on top of the
   * sync/coverage pipeline above: quality score weights (Fase 2), curation thresholds
   * (Fase 3), which watch-providers region to persist (Fase 4), and collection-tag
   * thresholds (Fase 7). Every weight/threshold lives here — never a magic number
   * inside lib/catalog/quality-score.ts, curation.ts or collection-tags.ts.
   */
  catalogQuality: {
    qualityWeights: {
      popularity: parseNumberFlag(rawEnv.TMDB_QUALITY_WEIGHT_POPULARITY, 1),
      voteAverage: parseNumberFlag(rawEnv.TMDB_QUALITY_WEIGHT_VOTE_AVERAGE, 1.5),
      voteCount: parseNumberFlag(rawEnv.TMDB_QUALITY_WEIGHT_VOTE_COUNT, 1),
      recency: parseNumberFlag(rawEnv.TMDB_QUALITY_WEIGHT_RECENCY, 1),
      status: parseNumberFlag(rawEnv.TMDB_QUALITY_WEIGHT_STATUS, 0.75),
      seasons: parseNumberFlag(rawEnv.TMDB_QUALITY_WEIGHT_SEASONS, 0.5),
      episodes: parseNumberFlag(rawEnv.TMDB_QUALITY_WEIGHT_EPISODES, 0.5),
      backdrop: parseNumberFlag(rawEnv.TMDB_QUALITY_WEIGHT_BACKDROP, 0.5),
      poster: parseNumberFlag(rawEnv.TMDB_QUALITY_WEIGHT_POSTER, 0.5),
      overview: parseNumberFlag(rawEnv.TMDB_QUALITY_WEIGHT_OVERVIEW, 0.5),
      logo: parseNumberFlag(rawEnv.TMDB_QUALITY_WEIGHT_LOGO, 0.25),
      providers: parseNumberFlag(rawEnv.TMDB_QUALITY_WEIGHT_PROVIDERS, 0.75),
      originCountry: parseNumberFlag(rawEnv.TMDB_QUALITY_WEIGHT_ORIGIN_COUNTRY, 0.25),
      language: parseNumberFlag(rawEnv.TMDB_QUALITY_WEIGHT_LANGUAGE, 0.25)
    },
    curation: {
      enabled: parseBooleanFlag(rawEnv.TMDB_CURATION_ENABLED, true),
      minVoteAverage: parseNumberFlag(rawEnv.TMDB_MIN_VOTE_AVERAGE, 0),
      requireImage: parseBooleanFlag(rawEnv.TMDB_CURATION_REQUIRE_IMAGE, true),
      requireOverview: parseBooleanFlag(rawEnv.TMDB_CURATION_REQUIRE_OVERVIEW, true),
      maxPilotAgeDays: Math.max(0, parseNumberFlag(rawEnv.TMDB_CURATION_MAX_PILOT_AGE_DAYS, 365))
    },
    watchProvidersRegion: rawEnv.TMDB_WATCH_PROVIDERS_REGION ?? "BR",
    tags: {
      maratonaMinEpisodes: parseNumberFlag(rawEnv.TMDB_TAG_MARATONA_MIN_EPISODES, 100),
      minisserieMaxEpisodes: parseNumberFlag(rawEnv.TMDB_TAG_MINISSERIE_MAX_EPISODES, 8),
      premiadaMinVoteAverage: parseNumberFlag(rawEnv.TMDB_TAG_PREMIADA_MIN_VOTE_AVERAGE, 8),
      premiadaMinVoteCount: parseNumberFlag(rawEnv.TMDB_TAG_PREMIADA_MIN_VOTE_COUNT, 1000),
      emAltaMinPopularity: parseNumberFlag(rawEnv.TMDB_TAG_EM_ALTA_MIN_POPULARITY, 50),
      longaDuracaoMinSeasons: parseNumberFlag(rawEnv.TMDB_TAG_LONGA_DURACAO_MIN_SEASONS, 5)
    }
  },
  /**
   * Fase 1-5 (INSERIES-TRENDING-DISCOVERY-ENGINE-01) — the editorial ranking layer that
   * decides which TMDb candidates actually enter the queue and how relevant they are,
   * separate from (and never modifying) the existing catalogSync/catalogQuality knobs
   * above. Every weight/threshold configurable, same "no magic number in the engine
   * itself" discipline as the rest of this file.
   */
  discoveryEngine: {
    // Fase 2 — per-source weight, normalized against their own sum (so they always add
    // up to 1 regardless of what the operator sets), used to rank candidates by "how much
    // real-world signal backs this series" rather than raw popularity alone.
    sourceWeights: {
      trending: parseNumberFlag(rawEnv.DISCOVERY_SOURCE_WEIGHT_TRENDING, 0.4),
      onTheAir: parseNumberFlag(rawEnv.DISCOVERY_SOURCE_WEIGHT_ON_THE_AIR, 0.25),
      popular: parseNumberFlag(rawEnv.DISCOVERY_SOURCE_WEIGHT_POPULAR, 0.15),
      topRated: parseNumberFlag(rawEnv.DISCOVERY_SOURCE_WEIGHT_TOP_RATED, 0.1),
      discover: parseNumberFlag(rawEnv.DISCOVERY_SOURCE_WEIGHT_DISCOVER, 0.1)
    },
    // Fase 4 — series available on any of these get a streaming-priority bonus in the
    // Discovery Score. A configurable list (not one env var per provider) so operators
    // can reorder/replace the roster without a code change.
    streamingPriorityList: parseStringList(rawEnv.DISCOVERY_STREAMING_PRIORITY_LIST, [
      "Netflix",
      "Max",
      "Prime Video",
      "Disney+",
      "Apple TV+",
      "Paramount+",
      "Hulu",
      "Peacock",
      "Crunchyroll",
      "Globoplay"
    ]),
    // Fase 5 — dedicated to the Discovery Engine's own candidate intake (never the
    // existing catalogQuality.curation gate, which keeps gating syncPopularSeries/
    // syncCoverage/etc. exactly as before). Defaults are deliberately non-zero — unlike
    // catalogQuality.curation.minVoteAverage/catalogSync.minVoteCount (both 0/off by
    // default) — because this sprint's whole point is to stop obscure series from
    // reaching the surfaces the Discovery Engine feeds (Trending Collections, Hero,
    // Bombando Agora).
    blacklist: {
      enabled: parseBooleanFlag(rawEnv.DISCOVERY_BLACKLIST_ENABLED, true),
      minVoteCount: parseNumberFlag(rawEnv.DISCOVERY_BLACKLIST_MIN_VOTE_COUNT, 100),
      minVoteAverage: parseNumberFlag(rawEnv.DISCOVERY_BLACKLIST_MIN_VOTE_AVERAGE, 5.5),
      requirePoster: parseBooleanFlag(rawEnv.DISCOVERY_BLACKLIST_REQUIRE_POSTER, true),
      requireBackdrop: parseBooleanFlag(rawEnv.DISCOVERY_BLACKLIST_REQUIRE_BACKDROP, true),
      requireOverview: parseBooleanFlag(rawEnv.DISCOVERY_BLACKLIST_REQUIRE_OVERVIEW, true),
      requireEpisodes: parseBooleanFlag(rawEnv.DISCOVERY_BLACKLIST_REQUIRE_EPISODES, true),
      maxPilotAgeDays: Math.max(0, parseNumberFlag(rawEnv.DISCOVERY_BLACKLIST_MAX_PILOT_AGE_DAYS, 365))
    },
    // Fase 3 — weights for the Premium Discovery Score (0-100), same "normalize each
    // signal to 0-1, multiply by weight, sum, scale by total weight used" shape as
    // catalogQuality.qualityWeights above — deliberately a distinct set of weights
    // (never reusing qualityWeights directly), since the ticket asks for a score that
    // reflects *discovery* relevance (trending/streaming presence/recency-weighted
    // popularity), not editorial completeness.
    scoreWeights: {
      trending: parseNumberFlag(rawEnv.DISCOVERY_SCORE_WEIGHT_TRENDING, 2.5),
      popularity: parseNumberFlag(rawEnv.DISCOVERY_SCORE_WEIGHT_POPULARITY, 1.5),
      voteAverage: parseNumberFlag(rawEnv.DISCOVERY_SCORE_WEIGHT_VOTE_AVERAGE, 1),
      voteCount: parseNumberFlag(rawEnv.DISCOVERY_SCORE_WEIGHT_VOTE_COUNT, 1),
      recency: parseNumberFlag(rawEnv.DISCOVERY_SCORE_WEIGHT_RECENCY, 1),
      status: parseNumberFlag(rawEnv.DISCOVERY_SCORE_WEIGHT_STATUS, 0.5),
      providers: parseNumberFlag(rawEnv.DISCOVERY_SCORE_WEIGHT_PROVIDERS, 1.5),
      seasons: parseNumberFlag(rawEnv.DISCOVERY_SCORE_WEIGHT_SEASONS, 0.25),
      episodes: parseNumberFlag(rawEnv.DISCOVERY_SCORE_WEIGHT_EPISODES, 0.25),
      backdrop: parseNumberFlag(rawEnv.DISCOVERY_SCORE_WEIGHT_BACKDROP, 0.5),
      poster: parseNumberFlag(rawEnv.DISCOVERY_SCORE_WEIGHT_POSTER, 0.25),
      collectionTags: parseNumberFlag(rawEnv.DISCOVERY_SCORE_WEIGHT_COLLECTION_TAGS, 0.5),
      qualityScore: parseNumberFlag(rawEnv.DISCOVERY_SCORE_WEIGHT_QUALITY_SCORE, 1.5)
    },
    // Fase 2/12 — hard cap on how many ranked candidates one Discovery Engine run will
    // actually fetch+upsert. The ticket is explicit: "O objetivo não é importar mais
    // séries. É importar as séries certas" — so unlike syncCoverage (which processes
    // every candidate that clears the weak existing filters), this engine only ever
    // touches its top-N ranked, blacklist-passing candidates per run.
    maxCandidatesPerRun: Math.max(1, parseNumberFlag(rawEnv.DISCOVERY_ENGINE_MAX_CANDIDATES, 100))
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

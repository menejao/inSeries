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

export const socialAutomationConfig = {
  environment: parseEnvironment(rawEnv.SOCIAL_AUTOMATION_ENVIRONMENT),
  mode: parseMode(rawEnv.SOCIAL_AUTOMATION_MODE),
  scheduleTimes: parseScheduleTimes(rawEnv.SOCIAL_AUTOMATION_SCHEDULE_TIMES),
  dailyPostCount: parseDailyPostCount(rawEnv.SOCIAL_AUTOMATION_DAILY_POST_COUNT),
  enabledNetworks: parseEnabledNetworks(rawEnv.SOCIAL_AUTOMATION_ENABLED_NETWORKS),
  logLevel: (rawEnv.SOCIAL_AUTOMATION_LOG_LEVEL ?? "info") as "debug" | "info" | "warn" | "error"
};

export type SocialAutomationConfig = typeof socialAutomationConfig;

/** True only in "production" — every real-publish gate in the package must check this. */
export function isRealPublishAllowed(): boolean {
  return socialAutomationConfig.environment === "production";
}

export function isNetworkEnabled(network: string): boolean {
  return (socialAutomationConfig.enabledNetworks as string[]).includes(network.toLowerCase());
}

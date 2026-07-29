import { config } from "@/lib/config";

/**
 * INSERIES-SUPPORTER-SYSTEM-01 — the single gate every entry point (nav item, /apoie route,
 * API routes) checks. While `config.featureFlags.supporterPublicLaunch` is false, only admins
 * can reach the program — "essa restricao devera ser facilmente removida futuramente": flip
 * that one flag and this function starts returning true for every authenticated user, no
 * other code changes anywhere.
 */
export function canAccessSupporterProgram(role: string | undefined | null): boolean {
  if (config.featureFlags.supporterPublicLaunch) return true;
  return role === "ADMIN";
}

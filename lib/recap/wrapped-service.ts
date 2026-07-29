import { config } from "@/lib/config";
import { isFeatureEnabled } from "@/lib/config/flags";
import { computeWrappedData } from "@/lib/recap/wrapped";
import { getCachedWrapped, setCachedWrapped } from "@/lib/recap/wrapped-cache";
import type { WrappedData } from "@/lib/recap/wrapped-types";

/** Single entry point for the annual Wrapped — cached (lib/recap/wrapped-cache.ts), gated by the `recapWrapped` feature flag. Access-window/admin gating happens in the route (lib/recap/window.ts), not here. */
export async function getWrappedData(userId: string, year: number): Promise<WrappedData | null> {
  if (!isFeatureEnabled("recapWrapped")) return null;

  const cached = getCachedWrapped(userId, year);
  if (cached) return cached;

  const data = await computeWrappedData(userId, year);
  setCachedWrapped(userId, year, data, config.recapWrapped.cacheTtlSeconds);
  return data;
}

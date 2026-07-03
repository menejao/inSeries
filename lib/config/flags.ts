import { config, type FeatureFlag } from "@/lib/config";

export type { FeatureFlag };

/**
 * Feature flags are config-driven for now (env vars, see lib/config/index.ts).
 * `source` exists so a future FeatureFlagSource backed by SystemSetting/DB can
 * be swapped in without changing call sites across the app.
 */
export interface FeatureFlagSource {
  isEnabled(flag: FeatureFlag): boolean;
  getAll(): Record<FeatureFlag, boolean>;
}

class ConfigFeatureFlagSource implements FeatureFlagSource {
  isEnabled(flag: FeatureFlag): boolean {
    return config.featureFlags[flag];
  }

  getAll(): Record<FeatureFlag, boolean> {
    return { ...config.featureFlags };
  }
}

const activeSource: FeatureFlagSource = new ConfigFeatureFlagSource();

export function isFeatureEnabled(flag: FeatureFlag): boolean {
  return activeSource.isEnabled(flag);
}

export function getAllFeatureFlags(): Record<FeatureFlag, boolean> {
  return activeSource.getAll();
}

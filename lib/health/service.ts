import { config } from "@/lib/config";
import { canUseDatabase } from "@/lib/db/health";

export function getHealthSnapshot() {
  return {
    status: "ok" as const,
    version: config.app.version,
    environment: config.app.env,
    timestamp: new Date().toISOString()
  };
}

export type ReadyChecks = {
  configuration: boolean;
  database: boolean;
};

export async function getReadySnapshot() {
  const checks: ReadyChecks = {
    configuration: Boolean(config.database.url),
    database: await canUseDatabase()
  };

  const ready = Object.values(checks).every(Boolean);

  return {
    status: ready ? ("ready" as const) : ("not_ready" as const),
    ready,
    checks,
    timestamp: new Date().toISOString()
  };
}

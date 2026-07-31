import { prisma } from "../db/client";
import { logger } from "../logger";

/**
 * INSERIES-SOCIAL-ADMIN-PANEL-03 — the ONE piece of social-automation configuration that is
 * mutable at runtime.
 *
 * Everything else in config/index.ts is env-var + zod, parsed once at module load: there is no
 * settings repository in this package and inventing one would be new business logic, so the
 * admin Configuracoes screen renders those values read-only. "Automation paused" is the ticket's
 * explicit exception, and rather than adding a table it reuses the main schema's existing
 * `SystemSetting` (key/value Json) — no migration, no new model.
 *
 * Note this is an intent flag, not a kill switch on a running process: no cron/job runner is
 * wired to this package yet (see scheduler/index.ts), so today it gates the panel's own
 * "generate now" action and is the flag a future runner is expected to read first.
 */

export const AUTOMATION_PAUSED_KEY = "social_automation.paused";

export interface AutomationPauseState {
  paused: boolean;
  updatedAt: Date | null;
  /** Free-form note recorded alongside the toggle (who/why), stored in the same Json value. */
  reason: string | null;
}

const DEFAULT_STATE: AutomationPauseState = { paused: false, updatedAt: null, reason: null };

function parseState(value: unknown, updatedAt: Date | null): AutomationPauseState {
  if (value === null || typeof value !== "object") {
    return { paused: Boolean(value), updatedAt, reason: null };
  }
  const record = value as Record<string, unknown>;
  return {
    paused: Boolean(record.paused),
    updatedAt,
    reason: typeof record.reason === "string" ? record.reason : null
  };
}

export async function getAutomationPauseState(): Promise<AutomationPauseState> {
  const row = await prisma.systemSetting.findUnique({ where: { key: AUTOMATION_PAUSED_KEY } });
  if (!row) return DEFAULT_STATE;
  return parseState(row.value, row.updatedAt);
}

export async function isAutomationPaused(): Promise<boolean> {
  return (await getAutomationPauseState()).paused;
}

export async function setAutomationPaused(paused: boolean, reason?: string | null): Promise<AutomationPauseState> {
  const value = { paused, reason: reason ?? null };

  const row = await prisma.systemSetting.upsert({
    where: { key: AUTOMATION_PAUSED_KEY },
    create: {
      key: AUTOMATION_PAUSED_KEY,
      value,
      description: "Automacao social pausada/retomada pelo painel administrativo (/admin/social).",
      public: false
    },
    update: { value }
  });

  logger.info("settings:automation-paused:changed", { module: "settings", metadata: { paused, reason: reason ?? null } });

  return parseState(row.value, row.updatedAt);
}

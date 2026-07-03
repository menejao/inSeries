import { logger } from "@/lib/logger";
import { isFeatureEnabled } from "@/lib/config/flags";
import { evaluateEvent } from "@/lib/gamification/engine";
import type { GamificationEvent } from "@/lib/gamification/types";

/**
 * The only function mutation call sites should import (progress, reviews,
 * lists, follow). Never throws — a gamification failure must never break
 * the real action that triggered it, so any error is logged and swallowed.
 */
export async function recordGamificationEvent(event: GamificationEvent): Promise<void> {
  if (!isFeatureEnabled("gamification")) return;

  try {
    await evaluateEvent(event);
  } catch (error) {
    logger.error("gamification_event_failed", {
      metadata: { eventType: event.type, userId: event.userId, error: error instanceof Error ? error.message : String(error) }
    });
  }
}

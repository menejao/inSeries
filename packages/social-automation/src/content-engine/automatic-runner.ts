import type { ContentEnginePipeline } from "./index";
import { socialAutomationConfig } from "../config";
import { logger } from "../logger";

/**
 * Architected but intentionally not implemented: this is the shape a future
 * automatic runner would take (pipeline in, an autonomous
 * generate-review-publish loop out, presumably driven by scheduler's
 * getDuePublications()). Calling it always throws — automatic mode is not
 * enabled in this codebase yet, only manual mode (see manual-flow/) is real.
 */
export interface AutomaticRunner {
  run(pipeline: ContentEnginePipeline): Promise<void>;
}

export class NotYetEnabledAutomaticRunner implements AutomaticRunner {
  async run(): Promise<void> {
    logger.warn("content-engine:automatic-runner:blocked", {
      module: "content-engine",
      metadata: { mode: socialAutomationConfig.mode }
    });
    throw new Error("Automatic mode is not yet enabled. Use the manual flow (packages/social-automation/src/manual-flow).");
  }
}

export function assertManualMode(): void {
  if (socialAutomationConfig.mode !== "manual") {
    throw new Error(`Automatic mode is not yet enabled (configured mode: "${socialAutomationConfig.mode}"). Only "manual" is runnable today.`);
  }
}

import { selectTopic, type SelectTopicResult } from "./select-topic";
import { getAutomationPauseState } from "../settings";
import { logger } from "../logger";

/**
 * INSERIES-SOCIAL-ADMIN-PANEL-03 — the "Gerar conteudo agora" action.
 *
 * It is a thin wrapper over the exact same `selectTopic` the CLI calls
 * (packages/social-automation/scripts/content-generate.ts), adding only the pause-state gate so a
 * paused automation cannot be bypassed by clicking the button. Selection, scoring, repetition
 * guards, CTA/hook/hashtag choice and persistence all stay inside select-topic.ts — this adds no
 * editorial rule of its own.
 */
export class AutomationPausedError extends Error {
  readonly code = "automation_paused";

  constructor() {
    super("A automacao social esta pausada. Retome-a em /admin/social/configuracoes para gerar conteudo.");
    this.name = "AutomationPausedError";
  }
}

export interface GenerateNowOptions {
  date?: Date;
  persist?: boolean;
  /** Preview/dry-run never persists and is therefore allowed even while paused. */
  ignorePause?: boolean;
}

export async function generateContentNow(options: GenerateNowOptions = {}): Promise<SelectTopicResult> {
  const persist = options.persist ?? true;

  if (persist && !options.ignorePause) {
    const { paused } = await getAutomationPauseState();
    if (paused) {
      logger.warn("content-engine:generate-now:blocked-paused", { module: "content-engine" });
      throw new AutomationPausedError();
    }
  }

  return selectTopic({ date: options.date, persist });
}

/**
 * INSERIES-INSTAGRAM-PUBLISHER-05 — in-memory publish queue.
 *
 * Two jobs, both of which the ticket asks for and neither of which justifies a Redis/BullMQ
 * dependency for a single-process worker:
 *
 *  1. **Idempotency (per publication).** Two concurrent `run(publicationId, …)` calls for the SAME
 *     id never execute the task twice — the second caller awaits the first one's promise and gets
 *     the same result. This is what stops a double-click in the admin panel from creating two
 *     Instagram posts.
 *  2. **Concurrency cap (global).** A FIFO semaphore, the same shape the Template Engine already
 *     uses for Playwright pages in `template-engine/renderer/index.ts` (an array of resolvers, no
 *     new dependency). Default 1: one publish at a time, which is what a rate-limited API wants.
 *
 * In-memory means single-process. That is stated rather than hidden: with more than one worker
 * process the DB status guard in `services/publish-service.ts` (refusing to act on a row already
 * UPLOADING/PUBLISHING) is the real backstop, and this queue is the fast local one.
 */
import { logger } from "../../logger";

export interface PublishQueueOptions {
  maxConcurrent?: number;
}

export class PublishQueue {
  private readonly maxConcurrent: number;
  private active = 0;
  private readonly waiting: Array<() => void> = [];
  /** publicationId -> in-flight promise. Deleted as soon as the task settles. */
  private readonly inFlight = new Map<string, Promise<unknown>>();

  constructor(options: PublishQueueOptions = {}) {
    this.maxConcurrent = Math.max(1, options.maxConcurrent ?? 1);
  }

  /** Ids currently executing or queued. Exposed for the admin panel / tests. */
  get inFlightIds(): string[] {
    return [...this.inFlight.keys()];
  }

  get depth(): number {
    return this.waiting.length;
  }

  isInFlight(publicationId: string): boolean {
    return this.inFlight.has(publicationId);
  }

  private async acquire(): Promise<void> {
    if (this.active < this.maxConcurrent) {
      this.active++;
      return;
    }
    await new Promise<void>((resolve) => this.waiting.push(resolve));
    this.active++;
  }

  private release(): void {
    this.active--;
    const next = this.waiting.shift();
    if (next) next();
  }

  /**
   * Runs `task` for `publicationId`, deduplicated and rate-limited. Rejections propagate to every
   * caller that joined the same in-flight run — nobody silently thinks it succeeded.
   */
  run<T>(publicationId: string, task: () => Promise<T>): Promise<T> {
    const existing = this.inFlight.get(publicationId);
    if (existing) {
      logger.info("publisher:queue:deduplicated", { module: "publisher", metadata: { publicationId } });
      return existing as Promise<T>;
    }

    const promise = (async () => {
      await this.acquire();
      try {
        return await task();
      } finally {
        this.release();
      }
    })();

    // Registered synchronously — a second caller in the same tick must already see it.
    this.inFlight.set(publicationId, promise);

    return promise.finally(() => {
      this.inFlight.delete(publicationId);
    }) as Promise<T>;
  }
}

/** Process-wide queue used by publish-service.ts. Tests build their own instance instead. */
export const publishQueue = new PublishQueue({ maxConcurrent: 1 });

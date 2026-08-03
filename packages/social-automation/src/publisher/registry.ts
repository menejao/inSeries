import { ConsoleLogPublisher } from "./console-log-publisher";
import { InstagramGraphPublisher } from "./instagram/instagram-publisher";
import { assertMetaConfigured, hasMetaCredentials, isRealPublishAllowed } from "../config";
import { logger } from "../logger";
import type { Publisher } from "./types";

/**
 * Keyed by lowercase network name (matches SocialNetwork enum values
 * lowercased, e.g. "instagram" for SocialNetwork.INSTAGRAM). To support a new
 * network: implement Publisher and add one line here — nothing else in the
 * pipeline needs to know about it.
 *
 * INSERIES-INSTAGRAM-PUBLISHER-05 — "instagram" now resolves to the REAL
 * `InstagramGraphPublisher` under exactly two simultaneous conditions:
 *   1. `isRealPublishAllowed()` — SOCIAL_AUTOMATION_ENVIRONMENT === "production"; and
 *   2. every mandatory Meta credential is present.
 * Otherwise it stays `ConsoleLogPublisher`, so development and homologation behave EXACTLY as they
 * did before this ticket: no network call, a fake externalId, and publisher/status.ts keeps
 * reporting "Nao configurado". Neither branch is silent — see the logs below.
 */
function createInstagramPublisher(): Publisher {
  if (!isRealPublishAllowed()) {
    if (hasMetaCredentials()) {
      logger.warn("publisher:registry:real-publisher-withheld", {
        module: "publisher",
        metadata: { network: "instagram", reason: "credenciais presentes mas o ambiente nao e production — mantido ConsoleLogPublisher" }
      });
    }
    return new ConsoleLogPublisher();
  }

  // Production with an incomplete Meta config must fail loudly at startup rather than attempt a
  // half-configured real post.
  assertMetaConfigured();

  logger.info("publisher:registry:real-publisher-enabled", { module: "publisher", metadata: { network: "instagram" } });
  return new InstagramGraphPublisher();
}

export const publisherRegistry: Record<string, Publisher> = {
  instagram: createInstagramPublisher()
};

export function getPublisher(network: string): Publisher {
  const publisher = publisherRegistry[network.toLowerCase()];
  if (!publisher) {
    throw new Error(`No Publisher registered for network "${network}". Registered: ${Object.keys(publisherRegistry).join(", ")}`);
  }
  return publisher;
}

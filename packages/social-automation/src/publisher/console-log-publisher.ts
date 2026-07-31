import { logger } from "../logger";
import type { Publisher, PublishResult } from "./types";
import type { SocialPublication } from "@prisma/client";

/**
 * The only Publisher wired up today. Registered under "instagram" — makes no
 * network call, just logs what it would have posted and returns a fake
 * externalId. This is the intended pattern for every future real network
 * integration (Instagram Graph API, TikTok, X, etc): implement Publisher,
 * register it in publisherRegistry under the network's key.
 */
export class ConsoleLogPublisher implements Publisher {
  async publish(publication: SocialPublication): Promise<PublishResult> {
    const externalId = `fake-${publication.network.toLowerCase()}-${publication.id}`;

    logger.info("publisher:console-log:publish", {
      module: "publisher",
      metadata: {
        publicationId: publication.id,
        network: publication.network,
        captionPreview: publication.caption.slice(0, 80),
        mediaRef: publication.mediaRef,
        externalId
      }
    });

    return { externalId };
  }
}

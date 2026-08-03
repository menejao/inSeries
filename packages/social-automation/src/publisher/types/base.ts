import type { SocialPublication } from "@prisma/client";

export interface PublishResult {
  externalId: string;
}

/**
 * Extension point for future real network integrations. Adding a new
 * network = implementing this interface and registering it under a new key
 * in `publisherRegistry` (see registry.ts) — nothing else in the package
 * needs to change.
 */
export interface Publisher {
  publish(publication: SocialPublication): Promise<PublishResult>;
}

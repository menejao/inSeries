import { ConsoleLogPublisher } from "./console-log-publisher";
import type { Publisher } from "./types";

/**
 * Keyed by lowercase network name (matches SocialNetwork enum values
 * lowercased, e.g. "instagram" for SocialNetwork.INSTAGRAM). To support a new
 * network: implement Publisher and add one line here — nothing else in the
 * pipeline needs to know about it.
 */
export const publisherRegistry: Record<string, Publisher> = {
  instagram: new ConsoleLogPublisher()
};

export function getPublisher(network: string): Publisher {
  const publisher = publisherRegistry[network.toLowerCase()];
  if (!publisher) {
    throw new Error(`No Publisher registered for network "${network}". Registered: ${Object.keys(publisherRegistry).join(", ")}`);
  }
  return publisher;
}

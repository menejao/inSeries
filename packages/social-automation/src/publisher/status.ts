import { ConsoleLogPublisher } from "./console-log-publisher";
import { publisherRegistry } from "./registry";
import { isNetworkEnabled, isRealPublishAllowed, socialAutomationConfig } from "../config";

/**
 * INSERIES-SOCIAL-ADMIN-PANEL-03 — derives, from the registry + config that already exist, whether
 * a network can actually post. Lives here rather than in the admin UI so the panel does not have
 * to know that "ConsoleLogPublisher means fake" — that fact belongs to the publisher module.
 *
 * Today this always returns configured:false for every network: the registry maps "instagram" to
 * ConsoleLogPublisher, which makes no network call at all.
 */

export interface NetworkPublisherStatus {
  network: string;
  /** True only when a real (non ConsoleLogPublisher) Publisher is registered. */
  configured: boolean;
  /** Whether the network appears in config.enabledNetworks. */
  enabled: boolean;
  publisherName: string;
  /** True when a registered real publisher would actually be allowed to post (production env). */
  realPublishAllowed: boolean;
  label: string;
}

export function getNetworkPublisherStatus(network: string): NetworkPublisherStatus {
  const key = network.toLowerCase();
  const publisher = publisherRegistry[key];
  const configured = Boolean(publisher) && !(publisher instanceof ConsoleLogPublisher);
  const enabled = isNetworkEnabled(key);

  return {
    network: key,
    configured,
    enabled,
    publisherName: publisher ? publisher.constructor.name : "—",
    realPublishAllowed: configured && enabled && isRealPublishAllowed(),
    label: !publisher ? "Sem publisher registrado" : configured ? (enabled ? "Configurado" : "Configurado (rede desabilitada)") : "Nao configurado"
  };
}

/** Status for every network in the registry, plus any enabled network with no publisher at all. */
export function listNetworkPublisherStatuses(): NetworkPublisherStatus[] {
  const keys = new Set<string>([...Object.keys(publisherRegistry), ...socialAutomationConfig.enabledNetworks]);
  return [...keys].sort().map(getNetworkPublisherStatus);
}

/** True when no network can actually publish — drives the panel's global "integracao nao ativa" warning. */
export function noNetworkIsConfigured(): boolean {
  return listNetworkPublisherStatuses().every((status) => !status.configured);
}

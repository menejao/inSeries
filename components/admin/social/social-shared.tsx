import { Alert } from "@/components/ui/alert";
import { Badge, type BadgeVariant } from "@/components/ui/badge";

/**
 * INSERIES-SOCIAL-ADMIN-PANEL-03 — presentation-only helpers shared by the social admin screens.
 * Pure formatting and colour mapping; no data access and no rules.
 */

export const CONTENT_STATUS_VARIANT: Record<string, BadgeVariant> = {
  DRAFT: "default",
  PENDING_APPROVAL: "warning",
  APPROVED: "success",
  REJECTED: "danger",
  PUBLISHED: "primary",
  FAILED: "danger",
  ARCHIVED: "outline"
};

export const PUBLICATION_STATUS_VARIANT: Record<string, BadgeVariant> = {
  PENDING: "default",
  SCHEDULED: "secondary",
  PUBLISHING: "warning",
  PUBLISHED: "success",
  FAILED: "danger"
};

export function ContentStatusBadge({ status }: { status: string }) {
  return <Badge variant={CONTENT_STATUS_VARIANT[status] ?? "default"}>{status}</Badge>;
}

export function PublicationStatusBadge({ status }: { status: string }) {
  return <Badge variant={PUBLICATION_STATUS_VARIANT[status] ?? "default"}>{status}</Badge>;
}

const DATE_TIME_FORMAT = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit"
});

export function formatDateTime(date: Date | null | undefined): string {
  return date ? DATE_TIME_FORMAT.format(date) : "-";
}

/** Value for an <input type="datetime-local"> — local time, no timezone suffix. */
export function toDateTimeLocalValue(date: Date): string {
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

/**
 * Shown wherever a publication status is displayed. `anyNetworkConfigured` comes from the
 * package's publisher/status.ts, which today always reports false because the registry maps
 * "instagram" to ConsoleLogPublisher.
 */
export function IntegrationNotActiveWarning({ anyNetworkConfigured }: { anyNetworkConfigured: boolean }) {
  if (anyNetworkConfigured) return null;

  return (
    <Alert variant="warning" title="Integracao com Instagram ainda nao esta ativa">
      Nenhuma publicacao real ocorre. O unico publisher registrado e o ConsoleLogPublisher, que apenas registra em log o que
      seria postado — os status abaixo refletem apenas o fluxo interno.
    </Alert>
  );
}

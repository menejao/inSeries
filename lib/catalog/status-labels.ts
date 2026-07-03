import type { BadgeVariant } from "@/components/ui/badge";

/**
 * `Series.status` arrives already humanized by the catalog/discovery layers
 * (e.g. "IN_PRODUCTION" -> "IN PRODUCTION"), so lookups here normalize back
 * to the underscore form first.
 */
const STATUS_LABELS: Record<string, string> = {
  RETURNING: "Em exibicao",
  ENDED: "Finalizada",
  CANCELED: "Cancelada",
  IN_PRODUCTION: "Em producao",
  PILOT: "Piloto"
};

const STATUS_VARIANTS: Record<string, BadgeVariant> = {
  RETURNING: "success",
  ENDED: "default",
  CANCELED: "danger",
  IN_PRODUCTION: "secondary",
  PILOT: "warning"
};

function normalize(status: string) {
  return status.replaceAll(" ", "_").toUpperCase();
}

export function getStatusLabel(status: string) {
  return STATUS_LABELS[normalize(status)] ?? status;
}

export function getStatusBadgeVariant(status: string): BadgeVariant {
  return STATUS_VARIANTS[normalize(status)] ?? "default";
}

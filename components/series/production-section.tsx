import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { InfoRow } from "@/components/series/info-row";
import { getStatusLabel } from "@/lib/catalog/status-labels";
import type { Series } from "@/lib/types";

/**
 * Fase 6 (INSERIES-SERIES-PAGE-PREMIUM-01) — every field is independently conditional
 * ("nunca mostrar campos vazios"); the whole section only renders if at least one field
 * has data. All fields already existed on `Series`/`NormalizedCatalogSeries` — nothing new
 * fetched, nothing new synced.
 */
export function ProductionSection({ series }: { series: Series }) {
  const hasAnyDetail = Boolean(
    series.createdBy.length ||
      series.networks.length ||
      series.productionCompanies.length ||
      series.productionCountries.length ||
      series.spokenLanguages.length ||
      series.keywords.length ||
      series.homepage ||
      series.tagline ||
      series.type
  );

  if (!hasAnyDetail) return null;

  return (
    <Card className="space-y-4">
      <h2 className="text-lg font-semibold text-ink">Producao</h2>

      {series.tagline ? <p className="italic text-muted">&ldquo;{series.tagline}&rdquo;</p> : null}

      <dl className="grid grid-cols-2 gap-3 text-sm">
        {series.type ? <InfoRow label="Tipo" value={series.type} /> : null}
        <InfoRow label="Status" value={getStatusLabel(series.status)} />
        {series.createdBy.length ? <InfoRow label="Criadores" value={series.createdBy.join(", ")} /> : null}
        {series.networks.length ? <InfoRow label="Networks" value={series.networks.join(", ")} /> : null}
        {series.productionCompanies.length ? <InfoRow label="Produtoras" value={series.productionCompanies.join(", ")} /> : null}
        {series.productionCountries.length ? <InfoRow label="Paises de producao" value={series.productionCountries.join(", ")} /> : null}
        {series.spokenLanguages.length ? <InfoRow label="Idiomas falados" value={series.spokenLanguages.join(", ")} /> : null}
      </dl>

      {series.keywords.length ? (
        <div className="flex flex-wrap gap-1.5 border-t border-border pt-3">
          {series.keywords.slice(0, 8).map((keyword) => (
            <Link key={keyword} href={`/series?keyword=${encodeURIComponent(keyword)}`}>
              <Badge variant="outline">{keyword}</Badge>
            </Link>
          ))}
        </div>
      ) : null}

      {series.homepage ? (
        <a href={series.homepage} target="_blank" rel="noreferrer" className="link-accent block text-sm">
          Site oficial
        </a>
      ) : null}
    </Card>
  );
}

import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ProviderList } from "@/components/media/provider-badge";
import { InfoRow } from "@/components/series/info-row";
import { getStatusLabel } from "@/lib/catalog/status-labels";
import type { Series } from "@/lib/types";

/**
 * Fase 25 (INSERIES-CATALOG-SERIES-EXPERIENCE-V2) — Resumo + Producao + Detalhes + Onde
 * assistir unificados num unico bloco (antes: 3 Cards separados — Resumo, Producao,
 * "Onde assistir"). Cada subsecao continua condicional (nunca mostra campo vazio), mas agora
 * divide o mesmo Card com separadores, eliminando a fragmentacao visual.
 */
export function SeriesInfoBlock({
  series,
  totalEpisodes,
  progressPercent,
  watchedEpisodes,
  authenticated
}: {
  series: Series;
  totalEpisodes: number;
  progressPercent: number;
  watchedEpisodes: number;
  authenticated: boolean;
}) {
  const hasProductionDetail = Boolean(
    series.createdBy.length ||
      series.networks.length ||
      series.productionCompanies.length ||
      series.productionCountries.length ||
      series.spokenLanguages.length ||
      series.keywords.length ||
      series.homepage ||
      series.type
  );

  return (
    <Card className="space-y-5">
      <div className="space-y-3">
        <h2 className="text-lg font-semibold text-ink">Resumo</h2>
        <dl className="grid grid-cols-2 gap-3 text-sm">
          <InfoRow label="Idioma" value={series.language || "Nao informado"} />
          <InfoRow label="Plataforma" value={series.platform || "Nao informado"} />
          <InfoRow label="Temporadas" value={String(series.numberOfSeasons ?? "—")} />
          <InfoRow label="Episodios" value={String(series.numberOfEpisodes ?? totalEpisodes)} />
          <InfoRow label="Pais de origem" value={series.originCountry.length ? series.originCountry.join(", ") : "Nao informado"} />
          {typeof series.qualityScore === "number" ? <InfoRow label="Quality Score" value={String(Math.round(series.qualityScore))} /> : null}
        </dl>
        {authenticated ? (
          <div className="space-y-2 border-t border-border pt-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted">Seu progresso</span>
              <span className="font-semibold text-ink">{progressPercent}%</span>
            </div>
            <Progress value={progressPercent} label="Progresso da serie" />
            <p className="text-xs text-subtle">
              {watchedEpisodes} de {totalEpisodes} episodios assistidos
            </p>
          </div>
        ) : null}
      </div>

      {hasProductionDetail ? (
        <div className="space-y-3 border-t border-border pt-4">
          <h3 className="text-sm font-semibold uppercase tracking-[0.08em] text-subtle">Producao</h3>
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
            <div className="flex flex-wrap gap-1.5">
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
        </div>
      ) : null}

      {series.watchProviders.length ? (
        <div className="space-y-2 border-t border-border pt-4">
          <h3 className="text-sm font-semibold uppercase tracking-[0.08em] text-subtle">Onde assistir</h3>
          <ProviderList providers={series.watchProviders} className="flex flex-wrap gap-2" />
        </div>
      ) : null}
    </Card>
  );
}

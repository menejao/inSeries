import type { CoverageSummary } from "@/lib/catalog/sync";

/** Fase 11 — the exact report shape the ticket asks for: dot-padded label/value lines, blank line between each. */
const SOURCE_LABELS: Record<string, string> = {
  POPULAR_SERIES: "Fonte Popular",
  DISCOVER: "Fonte Discover",
  TOP_RATED: "Fonte Top Rated",
  ON_THE_AIR: "Fonte On The Air",
  AIRING_TODAY: "Fonte Airing Today",
  TRENDING: "Fonte Trending"
};

function padLine(label: string, value: string, width = 26) {
  const dots = ".".repeat(Math.max(3, width - label.length));
  return `${label}${dots}${value}`;
}

function formatDuration(ms: number) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

export function printCoverageReport(summary: CoverageSummary) {
  const lines: string[] = [];

  for (const [key, count] of Object.entries(summary.perSourceCounts)) {
    lines.push(padLine(SOURCE_LABELS[key] ?? `Fonte ${key}`, `${count} series`));
  }
  lines.push(padLine("Duplicadas removidas", String(summary.duplicatesRemoved)));
  lines.push(padLine("Fila final", `${summary.uniqueCount} series`));
  lines.push(padLine("Novas", String(summary.totals.importedSeriesCount)));
  lines.push(padLine("Atualizadas", String(summary.totals.updatedSeriesCount)));
  lines.push(padLine("Ignoradas (cadencia)", String(summary.skippedByCadenceCount)));
  lines.push(padLine("Descartadas (curadoria)", String(summary.observability.curatedOutCount)));
  lines.push(padLine("Tempo", formatDuration(summary.durationMs)));
  lines.push(padLine("Requests", String(summary.observability.requestCount)));
  lines.push(padLine("Retries", String(summary.observability.retryCount)));
  lines.push(padLine("Rate Limits", String(summary.observability.rateLimitHitCount)));
  lines.push(padLine("Cache Hits", String(summary.observability.cacheHits)));
  lines.push(padLine("Cache Miss", String(summary.observability.cacheMisses)));
  lines.push(padLine("Economia de chamadas", String(summary.observability.callsSaved)));

  const totalTouched = summary.totals.importedSeriesCount + summary.totals.updatedSeriesCount;
  const averageMsPerSeries = totalTouched > 0 ? Math.round(summary.durationMs / totalTouched) : 0;
  lines.push(padLine("Tempo medio/serie", `${averageMsPerSeries}ms`));
  lines.push(padLine("Quality Score medio", String(summary.observability.qualityScoreAverage)));
  lines.push(padLine("Providers encontrados", String(summary.observability.providersFoundCount)));
  lines.push(padLine("Logos encontrados", String(summary.observability.logosFoundCount)));
  lines.push(padLine("Keywords sincronizadas", String(summary.observability.keywordsSyncedCount)));
  lines.push(padLine("Tags geradas", String(summary.observability.tagsGeneratedCount)));

  console.log("");
  for (const line of lines) {
    console.log(line);
    console.log("");
  }

  console.log("Catalogo — quality score medio geral:", summary.catalogStatistics.averageQualityScore);
  console.log("Catalogo — total de series:", summary.catalogStatistics.totalSeries);
  console.log("Catalogo — por status:", summary.catalogStatistics.byStatus);
  console.log("Catalogo — por decada:", summary.catalogStatistics.byDecade);
  console.log("Catalogo — por provedor:", summary.catalogStatistics.byProvider);
  console.log("Listas inteligentes:", summary.smartListCounts);
  console.log("");

  if (summary.errors.length) {
    console.log(`Erros (${summary.errors.length}):`);
    summary.errors.slice(0, 10).forEach((error) => console.log(`  - ${error.series}: ${error.message}`));
    if (summary.errors.length > 10) console.log(`  ... e mais ${summary.errors.length - 10} erro(s)`);
    console.log("");
  }

  console.log(`Status....................${summary.status}${summary.resumed ? " (retomado)" : ""}`);
  console.log(`Run id....................${summary.runId}`);
}

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
  lines.push(padLine("Tempo", formatDuration(summary.durationMs)));
  lines.push(padLine("Requests", String(summary.observability.requestCount)));
  lines.push(padLine("Retries", String(summary.observability.retryCount)));
  lines.push(padLine("Rate Limits", String(summary.observability.rateLimitHitCount)));
  lines.push(padLine("Cache Hits", String(summary.observability.cacheHits)));
  lines.push(padLine("Cache Miss", String(summary.observability.cacheMisses)));

  console.log("");
  for (const line of lines) {
    console.log(line);
    console.log("");
  }

  if (summary.errors.length) {
    console.log(`Erros (${summary.errors.length}):`);
    summary.errors.slice(0, 10).forEach((error) => console.log(`  - ${error.series}: ${error.message}`));
    if (summary.errors.length > 10) console.log(`  ... e mais ${summary.errors.length - 10} erro(s)`);
    console.log("");
  }

  console.log(`Status....................${summary.status}${summary.resumed ? " (retomado)" : ""}`);
  console.log(`Run id....................${summary.runId}`);
}

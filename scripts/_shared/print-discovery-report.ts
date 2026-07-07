import type { DiscoveryEngineSummary } from "@/lib/discovery/engine";

/** Fase 11 — CLI output for `npm run discovery:run`, one place printing every observability metric the ticket asks for. */
export function printDiscoveryReport(summary: DiscoveryEngineSummary) {
  const obs = summary.observability;

  console.log(`\nDiscovery Engine (${summary.provider}) concluido.`);
  console.log(`  status: ${summary.status}`);
  console.log(`  duracao: ${summary.durationMs}ms`);
  console.log(`  series importadas: ${summary.totals.importedSeriesCount} | atualizadas: ${summary.totals.updatedSeriesCount}`);
  console.log(`  candidatos coletados (unicos): ${obs.candidatesCollected} | ranqueados apos blacklist de lista: ${obs.candidatesRanked}`);
  console.log(`  processados (top ranking): ${obs.processedCount} | descartados fora do ranking: ${obs.skippedByRankCount}`);
  console.log(`  descartados pela blacklist/curadoria: ${obs.discardedCount}`);
  if (Object.keys(obs.discardReasons).length) {
    console.log("  motivos de descarte:");
    Object.entries(obs.discardReasons)
      .sort((a, b) => b[1] - a[1])
      .forEach(([reason, count]) => console.log(`    - ${reason}: ${count}`));
  }
  console.log(`  Discovery Score medio (processados): ${obs.discoveryScoreAverage}`);
  console.log(`  Trending Score medio (processados): ${obs.trendingScoreAverage}`);
  console.log(`  series com providers encontrados: ${obs.providersFoundCount}`);
  console.log(`  requests TMDb: ${obs.requestCount} | retries: ${obs.retryCount} | rate limit atingido: ${obs.rateLimitHitCount}x`);

  const stats = summary.catalogStatistics;
  console.log(`  catalogo (snapshot): ${stats.totalSeries} series | Quality Score medio: ${stats.averageQualityScore}`);
  console.log(`  top status: ${Object.entries(stats.byStatus).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([k, v]) => `${k}=${v}`).join(", ")}`);
  console.log(`  top streamings: ${Object.entries(stats.byProvider).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([k, v]) => `${k}=${v}`).join(", ")}`);
  console.log(`  top categorias: ${Object.entries(stats.byGenre).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([k, v]) => `${k}=${v}`).join(", ")}`);
  console.log(`  top paises: ${Object.entries(stats.byCountry).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([k, v]) => `${k}=${v}`).join(", ")}`);
  console.log(`  top idiomas: ${Object.entries(stats.byLanguage).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([k, v]) => `${k}=${v}`).join(", ")}`);

  if (summary.errors.length) {
    console.log(`  erros (${summary.errors.length}):`);
    summary.errors.slice(0, 10).forEach((error) => console.log(`    - ${error.series}: ${error.message}`));
    if (summary.errors.length > 10) {
      console.log(`    ... e mais ${summary.errors.length - 10} erro(s)`);
    }
  }

  console.log(`  run id: ${summary.runId}`);
}

/** Returns true (and prints a friendly hint) when the run aborted because TMDb isn't configured. */
export function isDiscoveryEngineUnconfigured(summary: DiscoveryEngineSummary): boolean {
  if (summary.status === "FAILED" && summary.errors.length === 0 && summary.totals.importedSeriesCount === 0 && summary.observability.candidatesCollected === 0) {
    console.error("Discovery Engine abortado: TMDb nao configurado.");
    console.error("Configure TMDB_API_KEY ou TMDB_ACCESS_TOKEN no .env para rodar o Discovery Engine real.");
    return true;
  }
  return false;
}

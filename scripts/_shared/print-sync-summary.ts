import type { CatalogSyncSummary } from "@/lib/catalog/sync";

/** Shared CLI output for every `sync:*` script — one place to print counts, observability and errors consistently. */
export function printSyncSummary(label: string, summary: CatalogSyncSummary) {
  console.log(`\n${label}`);
  console.log(`  status: ${summary.status}`);
  console.log(`  duracao: ${summary.durationMs}ms`);
  console.log(`  series importadas: ${summary.importedSeriesCount} | atualizadas: ${summary.updatedSeriesCount}`);
  console.log(`  temporadas importadas: ${summary.importedSeasonCount} | atualizadas: ${summary.updatedSeasonCount}`);
  console.log(`  episodios importados: ${summary.importedEpisodeCount} | atualizados: ${summary.updatedEpisodeCount}`);

  if (summary.observability) {
    const obs = summary.observability;
    console.log(
      `  paginas processadas: ${obs.pagesProcessed} | requests TMDb: ${obs.requestCount} (media ${obs.averageRequestMs}ms) | retries: ${obs.retryCount} | rate limit atingido: ${obs.rateLimitHitCount}x`
    );
    console.log(`  atualizacoes leves (series ja catalogadas, sem novo fetch de temporadas/episodios): ${obs.lightweightUpdateCount} | ignorados por filtro de qualidade: ${obs.skippedCount}`);
  }

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
export function isUnconfiguredFailure(summary: CatalogSyncSummary): boolean {
  if (summary.status === "FAILED" && summary.errorMessage?.includes("TMDb nao configurado")) {
    console.error(`Sync abortado: ${summary.errorMessage}`);
    console.error("Configure TMDB_API_KEY ou TMDB_ACCESS_TOKEN no .env para sincronizar o catalogo real.");
    return true;
  }
  return false;
}

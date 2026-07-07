import { prisma } from "@/lib/db/prisma";
import { canUseDatabase } from "@/lib/db/health";
import { syncFullCatalog } from "@/lib/catalog/sync";
import { printSyncSummary } from "@/scripts/_shared/print-sync-summary";

async function main() {
  if (!(await canUseDatabase())) {
    console.error("Sync abortado: banco indisponivel. Verifique DATABASE_URL e rode as migrations.");
    process.exitCode = 1;
    return;
  }

  const result = await syncFullCatalog();

  if (result.status === "FAILED" && result.sources.length === 0) {
    console.error("Sync abortado: TMDb nao configurado. Defina TMDB_API_KEY ou TMDB_ACCESS_TOKEN no .env.");
    process.exitCode = 1;
    return;
  }

  console.log(`\nSincronizacao completa do catalogo concluida.`);
  console.log(`  status geral: ${result.status}`);
  console.log(`  duracao total: ${result.durationMs}ms`);
  console.log(
    `  totais — series importadas: ${result.totals.importedSeriesCount} | atualizadas: ${result.totals.updatedSeriesCount} | temporadas importadas: ${result.totals.importedSeasonCount} | atualizadas: ${result.totals.updatedSeasonCount} | episodios importados: ${result.totals.importedEpisodeCount} | atualizados: ${result.totals.updatedEpisodeCount}`
  );

  for (const source of result.sources) {
    printSyncSummary(`Fonte: ${source.type}`, source.summary);
  }

  console.log(`\n  run id (agregado): ${result.runId}`);

  if (result.status === "FAILED") {
    process.exitCode = 1;
  }
}

main()
  .catch((error) => {
    console.error("Falha inesperada na sincronizacao completa do catalogo.");
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

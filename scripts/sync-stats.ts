import { prisma } from "@/lib/db/prisma";
import { canUseDatabase } from "@/lib/db/health";
import { getLatestCoverageRun, getRecentSyncRuns } from "@/lib/catalog/sync";
import { computeCatalogStatistics } from "@/lib/catalog/statistics";
import { computeSmartListCounts } from "@/lib/catalog/smart-lists";

function printRun(run: Awaited<ReturnType<typeof getRecentSyncRuns>>[number]) {
  const durationMs = run.finishedAt ? run.finishedAt.getTime() - run.startedAt.getTime() : null;
  console.log(
    `  - [${run.type}] ${run.status} | inicio: ${run.startedAt.toISOString()} | duracao: ${durationMs !== null ? `${durationMs}ms` : "em andamento"} | novas: ${run.importedSeriesCount} | atualizadas: ${run.updatedSeriesCount} | run id: ${run.id}`
  );
}

async function main() {
  if (!(await canUseDatabase())) {
    console.error("Stats abortado: banco indisponivel. Verifique DATABASE_URL e rode as migrations.");
    process.exitCode = 1;
    return;
  }

  const latestCoverage = await getLatestCoverageRun();
  console.log("\nUltima sincronizacao de coverage:");
  if (!latestCoverage) {
    console.log("  nenhuma execucao de coverage encontrada ainda.");
  } else {
    printRun(latestCoverage);
  }

  const recentRuns = await getRecentSyncRuns(10);
  console.log(`\nUltimas ${recentRuns.length} execucoes de sincronizacao (qualquer tipo):`);
  recentRuns.forEach(printRun);

  const statistics = await computeCatalogStatistics();
  console.log("\nEstatisticas do catalogo (Fase 9):");
  console.log(`  total de series: ${statistics.totalSeries} | quality score medio: ${statistics.averageQualityScore}`);
  console.log("  por genero:", statistics.byGenre);
  console.log("  por pais:", statistics.byCountry);
  console.log("  por idioma:", statistics.byLanguage);
  console.log("  por status:", statistics.byStatus);
  console.log("  por provedor:", statistics.byProvider);
  console.log("  por decada:", statistics.byDecade);

  const smartListCounts = await computeSmartListCounts();
  console.log("\nCatalogo inteligente (Fase 10) — series por lista derivada:");
  console.log(" ", smartListCounts);
  console.log("");
}

main()
  .catch((error) => {
    console.error("Falha inesperada em sync:stats.");
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

import { prisma } from "@/lib/db/prisma";
import { canUseDatabase } from "@/lib/db/health";
import { getLatestCoverageRun, getRecentSyncRuns } from "@/lib/catalog/sync";

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

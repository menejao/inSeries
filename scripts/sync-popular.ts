import { prisma } from "@/lib/db/prisma";
import { canUseDatabase } from "@/lib/db/health";
import { syncPopularSeries } from "@/lib/catalog/sync";

function printSummary(label: string, summary: Awaited<ReturnType<typeof syncPopularSeries>>) {
  console.log(`\n${label}`);
  console.log(`  status: ${summary.status}`);
  console.log(`  duracao: ${summary.durationMs}ms`);
  console.log(`  series importadas: ${summary.importedSeriesCount} | atualizadas: ${summary.updatedSeriesCount}`);
  console.log(`  temporadas importadas: ${summary.importedSeasonCount} | atualizadas: ${summary.updatedSeasonCount}`);
  console.log(`  episodios importados: ${summary.importedEpisodeCount} | atualizados: ${summary.updatedEpisodeCount}`);
  if (summary.errors.length) {
    console.log(`  erros (${summary.errors.length}):`);
    summary.errors.slice(0, 10).forEach((error) => console.log(`    - ${error.series}: ${error.message}`));
    if (summary.errors.length > 10) {
      console.log(`    ... e mais ${summary.errors.length - 10} erro(s)`);
    }
  }
  console.log(`  run id: ${summary.runId}`);
}

async function main() {
  if (!(await canUseDatabase())) {
    console.error("Sync abortado: banco indisponivel. Verifique DATABASE_URL e rode as migrations.");
    process.exitCode = 1;
    return;
  }

  const pagesArg = Number(process.argv[2]);
  const pages = Number.isFinite(pagesArg) && pagesArg > 0 ? pagesArg : 1;

  const summary = await syncPopularSeries({ pages });

  if (summary.status === "FAILED" && summary.errorMessage?.includes("TMDb nao configurado")) {
    console.error(`Sync abortado: ${summary.errorMessage}`);
    console.error("Configure TMDB_API_KEY ou TMDB_ACCESS_TOKEN no .env para sincronizar o catalogo real.");
    process.exitCode = 1;
    return;
  }

  printSummary("Sync de series populares concluido.", summary);

  if (summary.status === "FAILED") {
    process.exitCode = 1;
  }
}

main()
  .catch((error) => {
    console.error("Falha inesperada no sync de series populares.");
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

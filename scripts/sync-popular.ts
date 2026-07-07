import { prisma } from "@/lib/db/prisma";
import { canUseDatabase } from "@/lib/db/health";
import { syncPopularSeries } from "@/lib/catalog/sync";
import { isUnconfiguredFailure, printSyncSummary } from "@/scripts/_shared/print-sync-summary";

async function main() {
  if (!(await canUseDatabase())) {
    console.error("Sync abortado: banco indisponivel. Verifique DATABASE_URL e rode as migrations.");
    process.exitCode = 1;
    return;
  }

  const pagesArg = Number(process.argv[2]);
  const pages = Number.isFinite(pagesArg) && pagesArg > 0 ? pagesArg : undefined;

  const summary = await syncPopularSeries({ pages });

  if (isUnconfiguredFailure(summary)) {
    process.exitCode = 1;
    return;
  }

  printSyncSummary("Sync de series populares concluido.", summary);

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

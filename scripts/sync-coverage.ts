import { prisma } from "@/lib/db/prisma";
import { canUseDatabase } from "@/lib/db/health";
import { syncCoverage } from "@/lib/catalog/sync";
import { printCoverageReport } from "@/scripts/_shared/print-coverage-report";

/** Fase 8 — a SIGINT never loses work: the last checkpoint is already persisted in CatalogSyncRun.metadata. */
process.on("SIGINT", () => {
  console.log("\nInterrompido. Progresso ja foi salvo — rode `npm run sync:resume` para continuar.");
  process.exit(130);
});

async function main() {
  if (!(await canUseDatabase())) {
    console.error("Sync abortado: banco indisponivel. Verifique DATABASE_URL e rode as migrations.");
    process.exitCode = 1;
    return;
  }

  const summary = await syncCoverage();
  printCoverageReport(summary);

  if (summary.status === "FAILED") {
    process.exitCode = 1;
  }
}

main()
  .catch((error) => {
    console.error("Falha inesperada na sincronizacao de coverage.");
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

import { prisma } from "@/lib/db/prisma";
import { canUseDatabase } from "@/lib/db/health";
import { resumeCoverage } from "@/lib/catalog/sync";
import { printCoverageReport } from "@/scripts/_shared/print-coverage-report";

process.on("SIGINT", () => {
  console.log("\nInterrompido. Progresso ja foi salvo — rode `npm run sync:resume` novamente para continuar.");
  process.exit(130);
});

async function main() {
  if (!(await canUseDatabase())) {
    console.error("Sync abortado: banco indisponivel. Verifique DATABASE_URL e rode as migrations.");
    process.exitCode = 1;
    return;
  }

  const result = await resumeCoverage();

  if (!result.resumed || !result.summary) {
    console.log("Nada para retomar: nao ha sincronizacao de coverage interrompida com fila pendente.");
    return;
  }

  printCoverageReport(result.summary);

  if (result.summary.status === "FAILED") {
    process.exitCode = 1;
  }
}

main()
  .catch((error) => {
    console.error("Falha inesperada em sync:resume.");
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

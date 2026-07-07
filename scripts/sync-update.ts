import { prisma } from "@/lib/db/prisma";
import { canUseDatabase } from "@/lib/db/health";
import { syncUpdateDue } from "@/lib/catalog/sync";
import { isUnconfiguredFailure, printSyncSummary } from "@/scripts/_shared/print-sync-summary";

async function main() {
  if (!(await canUseDatabase())) {
    console.error("Sync abortado: banco indisponivel. Verifique DATABASE_URL e rode as migrations.");
    process.exitCode = 1;
    return;
  }

  const summary = await syncUpdateDue();

  if (isUnconfiguredFailure(summary)) {
    process.exitCode = 1;
    return;
  }

  printSyncSummary("Atualizacao por cadencia (sync:update) concluida.", summary);

  if (summary.status === "FAILED") {
    process.exitCode = 1;
  }
}

main()
  .catch((error) => {
    console.error("Falha inesperada em sync:update.");
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

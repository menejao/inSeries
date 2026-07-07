import { prisma } from "@/lib/db/prisma";
import { canUseDatabase } from "@/lib/db/health";
import { runDiscoveryEngine } from "@/lib/discovery/engine";
import { isDiscoveryEngineUnconfigured, printDiscoveryReport } from "@/scripts/_shared/print-discovery-report";

/**
 * Fase 7 (INSERIES-TRENDING-DISCOVERY-ENGINE-01) — runs only the Discovery Engine
 * (Trending/On The Air/Popular/Top Rated/Discover, weighted+blacklisted+ranked), never
 * the full catalog. Meant to run frequently (e.g. daily cron) without reprocessing
 * everything `sync:coverage`/`sync:catalog` already cover.
 */
async function main() {
  if (!(await canUseDatabase())) {
    console.error("Discovery Engine abortado: banco indisponivel. Verifique DATABASE_URL e rode as migrations.");
    process.exitCode = 1;
    return;
  }

  const summary = await runDiscoveryEngine();

  if (isDiscoveryEngineUnconfigured(summary)) {
    process.exitCode = 1;
    return;
  }

  printDiscoveryReport(summary);

  if (summary.status === "FAILED") {
    process.exitCode = 1;
  }
}

main()
  .catch((error) => {
    console.error("Falha inesperada no Discovery Engine.");
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

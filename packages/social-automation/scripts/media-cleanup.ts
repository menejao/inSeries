/**
 * INSERIES-SOCIAL-PUBLIC-MEDIA-STORAGE-07 — varredura de retencao das artes hospedadas.
 *
 * NUNCA roda sozinho: nao ha cron, nao ha hook de request, nada no app chama este arquivo. E uma
 * invocacao manual (ou de um agendador externo do usuario), porque e o unico codigo destrutivo do
 * modulo de media-hosting.
 *
 *   npm run social:media:cleanup -- --dry-run     (padrao recomendado: so mostra o que apagaria)
 *   npm run social:media:cleanup -- --apply       (apaga de verdade)
 *
 * Sem `--apply` o script NAO apaga nada. Objetos dentro da janela de retencao
 * (SOCIAL_MEDIA_RETENTION_HOURS, minimo 24h) e objetos de publicacoes ainda em voo
 * (PENDING/SCHEDULED/UPLOADING/PUBLISHING) sao sempre preservados — ver src/media-hosting/cleanup.ts.
 */
import { describeMediaStorageConfig, mediaStorageConfig } from "../src/config";
import { getImageHostingService } from "../src/media-hosting";
import { cleanupExpiredMedia } from "../src/media-hosting/cleanup";
import { prisma } from "../src/db/client";
import { parseFlags, reportError } from "./_shared";

const SCRIPT = "social:media:cleanup";

async function main() {
  const flags = parseFlags(process.argv.slice(2));
  // Destrutivo so quando pedido explicitamente. `--dry-run` continua aceito e e redundante.
  const dryRun = flags.apply !== "true";

  const described = describeMediaStorageConfig();
  console.log(`[${SCRIPT}] provider=${described.provider} prefixo=${described.prefix} retencao=${described.retentionHours}h`);
  console.log(`[${SCRIPT}] modo=${dryRun ? "dry-run (nada sera apagado)" : "APPLY (remocao real)"}`);

  const service = getImageHostingService();
  if (!service.isConfigured()) {
    console.error(`[${SCRIPT}] Hospedagem publica nao configurada (${described.tokenEnvVar} ausente ou provider invalido).`);
    if (described.warning) console.error(`[${SCRIPT}] ${described.warning}`);
    console.error(`[${SCRIPT}] Nada a fazer. Provisione o Blob Store antes de rodar a limpeza.`);
    process.exitCode = 1;
    return;
  }

  const result = await cleanupExpiredMedia({ service, config: mediaStorageConfig, dryRun });

  console.log(`\n[${SCRIPT}] Resultado:`);
  console.log(`  objetos varridos:        ${result.scanned}`);
  console.log(`  dentro da retencao:      ${result.retained}`);
  console.log(`  preservados (em voo):    ${result.skippedInFlight.length}`);
  console.log(`  ${dryRun ? "seriam removidos" : "removidos"}:        ${result.deleted.length}`);
  console.log(`  falhas:                  ${result.failed.length}`);

  for (const pathname of result.deleted) console.log(`    ${dryRun ? "-" : "x"} ${pathname}`);
  for (const pathname of result.skippedInFlight) console.log(`    = ${pathname} (publicacao em voo)`);
  for (const failure of result.failed) console.error(`    ! ${failure.pathname}: ${failure.error}`);

  if (result.failed.length > 0) process.exitCode = 1;
  if (dryRun && result.deleted.length > 0) {
    console.log(`\n[${SCRIPT}] Rode novamente com --apply para remover de verdade.`);
  }
}

main()
  .catch((error) => reportError(SCRIPT, error))
  .finally(async () => {
    await prisma.$disconnect().catch(() => undefined);
  });

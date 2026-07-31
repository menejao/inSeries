import { publishApproved } from "../src/manual-flow/index";
import { prisma } from "../src/db/client";
import { parseFlags, reportError } from "./_shared";

async function main() {
  const flags = parseFlags(process.argv.slice(2));
  const contentId = flags.content;

  if (!contentId) {
    console.error("[social:publish] Uso: npm run social:publish -- --content <id>");
    process.exitCode = 1;
    return;
  }

  console.log(`[social:publish] Publicando conteudo aprovado ${contentId} (render -> media -> publisher -> history)`);

  const result = await publishApproved(contentId);

  console.log(`\n[social:publish] Publicado:`);
  console.log(`  contentId: ${result.contentId}`);
  console.log(`  publicationId: ${result.publicationId}`);
  console.log(`  externalId (fake, ConsoleLogPublisher): ${result.externalId}`);
}

main()
  .catch((error) => reportError("social:publish", error))
  .finally(async () => {
    await prisma.$disconnect().catch(() => undefined);
  });

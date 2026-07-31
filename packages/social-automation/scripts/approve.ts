import { approve } from "../src/manual-flow/index";
import { prisma } from "../src/db/client";
import { parseFlags, reportError } from "./_shared";

async function main() {
  const flags = parseFlags(process.argv.slice(2));
  const contentId = flags.content;

  if (!contentId) {
    console.error("[social:approve] Uso: npm run social:approve -- --content <id>");
    process.exitCode = 1;
    return;
  }

  console.log(`[social:approve] Aprovando conteudo ${contentId} (DRAFT -> APPROVED)`);

  const content = await approve(contentId);

  console.log(`\n[social:approve] Conteudo atualizado:`);
  console.log(`  id: ${content.id}`);
  console.log(`  status: ${content.status}`);
}

main()
  .catch((error) => reportError("social:approve", error))
  .finally(async () => {
    await prisma.$disconnect().catch(() => undefined);
  });

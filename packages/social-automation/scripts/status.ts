import { status } from "../src/manual-flow/index";
import { prisma } from "../src/db/client";
import { parseFlags, reportError } from "./_shared";

async function main() {
  const flags = parseFlags(process.argv.slice(2));
  const contentId = flags.content;

  if (!contentId) {
    console.error("[social:status] Uso: npm run social:status -- --content <id>");
    process.exitCode = 1;
    return;
  }

  const content = await status(contentId);

  console.log(`[social:status] Conteudo ${content.id}`);
  console.log(`  status: ${content.status}`);
  console.log(`  type: ${content.type}`);
  console.log(`  title: ${content.title}`);
  console.log(`  updatedAt: ${content.updatedAt.toISOString()}`);
}

main()
  .catch((error) => reportError("social:status", error))
  .finally(async () => {
    await prisma.$disconnect().catch(() => undefined);
  });

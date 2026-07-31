import { approveContent } from "../src/content-engine/approval";
import { prisma } from "../src/db/client";
import { parseFlags, reportError } from "./_shared";

async function main() {
  const flags = parseFlags(process.argv.slice(2));
  const id = flags.id;
  if (!id) throw new Error("content-approve: --id is required");

  console.log(`[social:content:approve] Aprovando conteudo ${id}`);
  const content = await approveContent(id);

  console.log(`\n[social:content:approve] Conteudo atualizado:`);
  console.log(`  id: ${content.id}`);
  console.log(`  status: ${content.status}`);
}

main()
  .catch((error) => reportError("social:content:approve", error))
  .finally(async () => {
    await prisma.$disconnect().catch(() => undefined);
  });

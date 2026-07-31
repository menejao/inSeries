import { rejectContent } from "../src/content-engine/approval";
import { prisma } from "../src/db/client";
import { parseFlags, reportError } from "./_shared";

async function main() {
  const flags = parseFlags(process.argv.slice(2));
  const id = flags.id;
  if (!id) throw new Error("content-reject: --id is required");
  const reason = flags.reason;

  console.log(`[social:content:reject] Rejeitando conteudo ${id}${reason ? ` (motivo: ${reason})` : ""}`);
  const content = await rejectContent(id, reason);

  console.log(`\n[social:content:reject] Conteudo atualizado:`);
  console.log(`  id: ${content.id}`);
  console.log(`  status: ${content.status}`);
}

main()
  .catch((error) => reportError("social:content:reject", error))
  .finally(async () => {
    await prisma.$disconnect().catch(() => undefined);
  });

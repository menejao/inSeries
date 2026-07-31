import { generate } from "../src/manual-flow/index";
import { prisma } from "../src/db/client";
import { parseFlags, reportError } from "./_shared";

async function main() {
  const flags = parseFlags(process.argv.slice(2));
  const title = flags.title ?? "Nova serie adicionada ao catalogo";
  const description = flags.description ?? "Descubra essa nova serie no inSeries.";
  const type = flags.type ?? "post";

  console.log(`[social:generate] Gerando conteudo DRAFT (manual, sem IA real)`);
  console.log(`  type: ${type}`);
  console.log(`  title: ${title}`);

  const content = await generate({ type, title, description });

  console.log(`\n[social:generate] Conteudo criado:`);
  console.log(`  id: ${content.id}`);
  console.log(`  status: ${content.status}`);
}

main()
  .catch((error) => reportError("social:generate", error))
  .finally(async () => {
    await prisma.$disconnect().catch(() => undefined);
  });

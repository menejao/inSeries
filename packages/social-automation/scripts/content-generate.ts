import { selectTopic } from "../src/content-engine/select-topic";
import { prisma } from "../src/db/client";
import { parseFlags, reportError } from "./_shared";

function parseDate(value: string | undefined): Date {
  if (!value) return new Date();
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) throw new Error(`content-generate: invalid --date "${value}", expected YYYY-MM-DD`);
  return parsed;
}

async function main() {
  const flags = parseFlags(process.argv.slice(2));
  const date = parseDate(flags.date);

  console.log(`[social:content:generate] Selecionando topico do dia (${date.toISOString().slice(0, 10)})`);

  const { payload, content } = await selectTopic({ date, persist: true });

  console.log(`\n[social:content:generate] Conteudo criado:`);
  console.log(`  id: ${content?.id}`);
  console.log(`  format: ${payload.format}`);
  console.log(`  title: ${payload.title}`);
  console.log(`  status: ${content?.status}`);
}

main()
  .catch((error) => reportError("social:content:generate", error))
  .finally(async () => {
    await prisma.$disconnect().catch(() => undefined);
  });

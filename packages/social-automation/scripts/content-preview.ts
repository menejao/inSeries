import { selectTopic } from "../src/content-engine/select-topic";
import { prisma } from "../src/db/client";
import { parseFlags, reportError } from "./_shared";

function parseDate(value: string | undefined): Date {
  if (!value) return new Date();
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) throw new Error(`content-preview: invalid --date "${value}", expected YYYY-MM-DD`);
  return parsed;
}

async function main() {
  const flags = parseFlags(process.argv.slice(2));
  const date = parseDate(flags.date);

  console.log(`[social:content:preview] Dry-run — nenhuma persistencia (${date.toISOString().slice(0, 10)})`);

  const { payload } = await selectTopic({ date, persist: false });

  console.log(`\n[social:content:preview] Payload estruturado:`);
  console.log(JSON.stringify(payload, null, 2));
}

main()
  .catch((error) => reportError("social:content:preview", error))
  .finally(async () => {
    await prisma.$disconnect().catch(() => undefined);
  });

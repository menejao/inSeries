/**
 * INSERIES-SOCIAL-TEMPLATE-ENGINE-04 — template sandbox.
 *
 * Renders every template with fictitious payloads (Breaking Bad, Dark, The Bear, Lioness,
 * The Last of Us) and writes real PNGs to packages/social-automation/.sandbox-output/ (gitignored).
 *
 * It never touches the database, the network or the Content Engine: the payloads are the static
 * fixtures in src/template-engine/sandbox/fixtures.ts, which mirror the shape the Content Engine
 * already persists. Rendering goes through the SAME `render()` the publisher/preview use.
 *
 * Usage:
 *   npm run social:template:sandbox
 *   npm run social:template:sandbox -- --template=ranking --theme=light
 *   npm run social:template:sandbox -- --html   (also dumps the HTML next to each PNG)
 */
import fs from "node:fs/promises";
import path from "node:path";
import { closeRenderer, generatePublicationPackage, getTemplateEntry, buildDocuments } from "../src/template-engine";
import { sandboxPayloads } from "../src/template-engine/sandbox/fixtures";
import type { ContentPayload } from "../src/template-engine/types";

const OUTPUT_DIR = path.join(process.cwd(), "packages", "social-automation", ".sandbox-output");

function arg(name: string): string | undefined {
  const hit = process.argv.slice(2).find((value) => value.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : undefined;
}

function flag(name: string): boolean {
  return process.argv.slice(2).includes(`--${name}`);
}

async function writeImage(file: string, buffer: Buffer): Promise<number> {
  await fs.writeFile(file, buffer);
  const stat = await fs.stat(file);
  return stat.size;
}

async function main(): Promise<void> {
  const only = arg("template");
  const theme = arg("theme") ?? null;
  const dumpHtml = flag("html");

  const payloads: ContentPayload[] = only ? sandboxPayloads.filter((p) => p.templateKey === only) : sandboxPayloads;
  if (payloads.length === 0) {
    console.error(`Nenhum payload de sandbox para --template=${only}`);
    process.exitCode = 1;
    return;
  }

  await fs.rm(OUTPUT_DIR, { recursive: true, force: true });
  await fs.mkdir(OUTPUT_DIR, { recursive: true });

  let files = 0;
  let bytes = 0;
  let empty = 0;

  for (const payload of payloads) {
    const entry = getTemplateEntry(payload.templateKey);
    console.log(`\n▸ ${payload.templateKey} — ${entry?.nome ?? "?"} (formatos: ${entry?.supports.join(", ")})`);

    const dir = path.join(OUTPUT_DIR, payload.templateKey);
    await fs.mkdir(dir, { recursive: true });

    const pack = await generatePublicationPackage(payload, { themeKey: theme });

    const images = [...(pack.feed ? [pack.feed] : []), ...pack.carousel, pack.story];
    for (const image of images) {
      const size = await writeImage(path.join(dir, image.fileName), image.buffer);
      files += 1;
      bytes += size;
      if (size === 0) empty += 1;
      console.log(`   ${size === 0 ? "✗" : "✓"} ${image.fileName}  ${image.width}x${image.height}  ${(size / 1024).toFixed(1)} KB`);
      console.log(`     alt: ${image.altText}`);
    }

    if (dumpHtml) {
      for (const format of ["feed", "carousel", "story"] as const) {
        if (format !== "story" && !entry?.supports.includes(format)) continue;
        buildDocuments(payload, format, { themeKey: theme }).forEach((doc, index) => {
          void fs.writeFile(path.join(dir, `${format}-${index + 1}-${doc.slideKey ?? "slide"}.html`), doc.html);
        });
      }
    }

    console.log(`   legenda: ${pack.caption || "(vazia)"}`);
    console.log(`   cta: ${pack.ctaText}`);
    console.log(`   hashtags: ${pack.hashtags.join(" ")}`);
    if (pack.warnings.length > 0) console.log(`   avisos: ${pack.warnings.join(" | ")}`);
  }

  console.log(`\n${files} imagens em ${OUTPUT_DIR} (${(bytes / 1024 / 1024).toFixed(2)} MB).`);
  if (empty > 0) {
    console.error(`${empty} arquivo(s) com 0 bytes — render falhou.`);
    process.exitCode = 1;
  }

  await closeRenderer();
}

main().catch(async (error) => {
  console.error(error);
  await closeRenderer();
  process.exit(1);
});

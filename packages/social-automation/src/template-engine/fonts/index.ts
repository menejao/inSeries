import fs from "node:fs";
import path from "node:path";

/**
 * Self-hosted web fonts.
 *
 * DECISION: the repo already vendors **Geist** (SIL OFL 1.1) inside `node_modules/next/.../font/`.
 * No font file could be downloaded in this session (the renderer must never depend on the
 * network — that is the whole point), so `geist-latin.woff2` / `geist-mono-latin.woff2` were
 * copied into this folder and are embedded as `data:` URIs at render time. Google Fonts CDN and
 * any other remote `@font-face src` is forbidden here: it would break in CI/production without
 * internet and make renders non-deterministic.
 *
 * FALLBACK: if a .woff2 file is missing at runtime, `fontFaceCss()` emits no `@font-face` and the
 * document falls back to the system stack declared in `typography.fontFamilySans`
 * (Segoe UI / Helvetica Neue / Arial). Renders stay valid, only the typeface changes.
 */

const FONT_FILES = {
  InSeriesSans: "geist-latin.woff2",
  InSeriesMono: "geist-mono-latin.woff2"
} as const;

type FontFamilyName = keyof typeof FONT_FILES;

function fontsDir(): string {
  // __dirname exists under tsx/CJS and Next's server bundle; fall back to a cwd-relative path.
  if (typeof __dirname === "string" && __dirname.length > 0) return __dirname;
  return path.join(process.cwd(), "packages", "social-automation", "src", "template-engine", "fonts");
}

const cache = new Map<FontFamilyName, string | null>();

function dataUri(family: FontFamilyName): string | null {
  if (cache.has(family)) return cache.get(family) ?? null;
  let result: string | null = null;
  try {
    const file = path.join(fontsDir(), FONT_FILES[family]);
    if (fs.existsSync(file)) {
      result = `data:font/woff2;base64,${fs.readFileSync(file).toString("base64")}`;
    }
  } catch {
    result = null;
  }
  cache.set(family, result);
  return result;
}

/** @font-face block with the fonts inlined as data URIs. Empty string when no file is available. */
export function fontFaceCss(): string {
  const blocks: string[] = [];
  for (const family of Object.keys(FONT_FILES) as FontFamilyName[]) {
    const uri = dataUri(family);
    if (!uri) continue;
    blocks.push(`@font-face {
  font-family: "${family}";
  src: url("${uri}") format("woff2");
  font-weight: 100 900;
  font-style: normal;
  font-display: block;
}`);
  }
  return blocks.join("\n");
}

/** True when at least one self-hosted font was embedded (used by tests/diagnostics). */
export function hasEmbeddedFonts(): boolean {
  return (Object.keys(FONT_FILES) as FontFamilyName[]).some((family) => dataUri(family) !== null);
}

// Generates the placeholder poster/backdrop/still art used by `npm run seed:dev`.
// This sandbox has no outbound access to image.tmdb.org, so the local dev catalog
// can't use real TMDb photos the way a real deployment (synced via lib/tmdb) does.
// These SVGs stand in for that real imagery so every image-driven UI (Hero, carousels,
// poster cards, Watch Next, series page) has something real to render locally instead
// of falling back to placeholders everywhere. Re-run with `node scripts/generate-dev-media.mjs`
// if the palette or set of seeded series ever changes.
import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const outDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "public", "dev-media");
mkdirSync(outDir, { recursive: true });

const SERIES = [
  { slug: "serie-teste-um", title: "Serie Teste Um", initials: "SU", from: "#4c1d95", to: "#0f172a" },
  { slug: "serie-teste-dois", title: "Serie Teste Dois", initials: "SD", from: "#c2410c", to: "#1c1917" },
  { slug: "serie-teste-tres", title: "Serie Teste Tres", initials: "ST", from: "#115e59", to: "#031014" },
  { slug: "serie-teste-quatro", title: "Serie Teste Quatro", initials: "SQ", from: "#6d28d9", to: "#0a1128" },
  { slug: "serie-teste-cinco", title: "Serie Teste Cinco", initials: "SC", from: "#9f1239", to: "#18181b" }
];

// No baked-in title text on poster/backdrop art: every place that renders these images
// (SeriesCard, SeriesPosterCard, Landing hero, series detail hero) already overlays the
// real title as HTML — baking it into the SVG too just doubles/overlaps the text.
function poster({ slug, initials, from, to }) {
  const svg = `<svg width="500" height="750" viewBox="0 0 500 750" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${from}"/>
      <stop offset="100%" stop-color="${to}"/>
    </linearGradient>
  </defs>
  <rect width="500" height="750" fill="url(#g)"/>
  <circle cx="250" cy="270" r="150" fill="#ffffff" fill-opacity="0.07"/>
  <circle cx="250" cy="270" r="95" fill="#ffffff" fill-opacity="0.06"/>
  <text x="250" y="300" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-size="72" font-weight="800" fill="#ffffff" fill-opacity="0.92">${initials}</text>
</svg>`;
  writeFileSync(path.join(outDir, `${slug}-poster.svg`), svg, "utf8");
}

function backdrop({ slug, from, to }) {
  const svg = `<svg width="1280" height="720" viewBox="0 0 1280 720" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${from}"/>
      <stop offset="100%" stop-color="${to}"/>
    </linearGradient>
  </defs>
  <rect width="1280" height="720" fill="url(#g)"/>
  <circle cx="1000" cy="200" r="260" fill="#ffffff" fill-opacity="0.05"/>
  <circle cx="220" cy="560" r="200" fill="#ffffff" fill-opacity="0.05"/>
</svg>`;
  writeFileSync(path.join(outDir, `${slug}-backdrop.svg`), svg, "utf8");
}

function still({ slug, season, from, to }) {
  const svg = `<svg width="640" height="360" viewBox="0 0 640 360" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${to}"/>
      <stop offset="100%" stop-color="${from}"/>
    </linearGradient>
  </defs>
  <rect width="640" height="360" fill="url(#g)"/>
  ${Array.from({ length: 6 }, (_, index) => `<rect x="${index * 110 - 20}" y="0" width="52" height="360" fill="#000000" fill-opacity="0.08" transform="skewX(-8)"/>`).join("\n  ")}
  <circle cx="320" cy="180" r="46" fill="#ffffff" fill-opacity="0.14"/>
  <path d="M308 158 L308 202 L344 180 Z" fill="#ffffff" fill-opacity="0.85"/>
  <text x="320" y="330" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-size="18" fill="#ffffff" fill-opacity="0.6">Temporada ${season}</text>
</svg>`;
  writeFileSync(path.join(outDir, `${slug}-s${season}-still.svg`), svg, "utf8");
}

for (const series of SERIES) {
  poster(series);
  backdrop(series);
}

const stillSeasons = [1, 2, 3];
for (const season of stillSeasons) {
  still({ slug: "serie-teste-um", season, from: SERIES[0].from, to: SERIES[0].to });
}
still({ slug: "serie-teste-dois", season: 1, from: SERIES[1].from, to: SERIES[1].to });
still({ slug: "serie-teste-dois", season: 2, from: SERIES[1].from, to: SERIES[1].to });
still({ slug: "serie-teste-tres", season: 1, from: SERIES[2].from, to: SERIES[2].to });

console.log(`Placeholder dev media gerada em public/dev-media (${SERIES.length} posters, ${SERIES.length} backdrops, 6 stills).`);

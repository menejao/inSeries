/**
 * INSERIES-SOCIAL-TEMPLATE-ENGINE-04 — design tokens.
 *
 * Single source of truth for every visual constant used by the template engine. Components must
 * NEVER hardcode a colour/spacing/radius: they read a CSS custom property (`var(--is-*)`) that is
 * emitted from these consts by `cssVariablesBlock()`. That keeps theming (themes/) a pure
 * variable swap instead of a per-component conditional.
 */

/** Base scale in px — everything derives from an 8px rhythm at 1080px canvas scale. */
export const spacing = {
  none: 0,
  xxs: 8,
  xs: 16,
  sm: 24,
  md: 40,
  lg: 64,
  xl: 88,
  xxl: 120
} as const;

export type SpacingToken = keyof typeof spacing;

/**
 * Safe area = minimum padding from the canvas border for ANY content (logo, CTA, text).
 * Story gets a bigger vertical inset because Instagram overlays its own UI on the top/bottom
 * ~250px of a 1920px story.
 */
export const safeArea = {
  square: { top: 72, right: 72, bottom: 72, left: 72 },
  portrait: { top: 80, right: 72, bottom: 80, left: 72 },
  story: { top: 220, right: 80, bottom: 240, left: 80 }
} as const;

export const radius = {
  none: 0,
  sm: 12,
  md: 20,
  lg: 32,
  xl: 48,
  pill: 999,
  circle: 9999
} as const;

export const typography = {
  fontFamilySans: `"InSeriesSans", "Segoe UI", "Helvetica Neue", Arial, sans-serif`,
  fontFamilyMono: `"InSeriesMono", "Cascadia Mono", "Courier New", monospace`,
  weight: { regular: 400, medium: 500, semibold: 600, bold: 700, black: 800 },
  /** px sizes tuned for a 1080px-wide canvas (they are NOT web sizes). */
  size: {
    micro: 20,
    caption: 26,
    body: 32,
    bodyLarge: 38,
    subtitle: 46,
    title: 62,
    display: 84,
    hero: 108
  },
  lineHeight: { tight: 1.05, snug: 1.2, normal: 1.35, relaxed: 1.5 },
  letterSpacing: { tight: "-0.02em", normal: "0", wide: "0.08em", wider: "0.18em" }
} as const;

export const shadows = {
  none: "none",
  sm: "0 4px 16px rgba(0,0,0,0.18)",
  md: "0 12px 40px rgba(0,0,0,0.28)",
  lg: "0 28px 80px rgba(0,0,0,0.38)",
  glow: "0 0 64px rgba(124,58,237,0.45)"
} as const;

export const borders = {
  hairline: 1,
  thin: 2,
  regular: 3,
  thick: 6
} as const;

/** 12-column grid over the canvas width, used by layouts/ to place blocks. */
export const grid = {
  columns: 12,
  gutter: spacing.sm,
  canvas: {
    feed: { width: 1080, height: 1080 },
    portrait: { width: 1080, height: 1350 },
    story: { width: 1080, height: 1920 }
  }
} as const;

export type CanvasKey = keyof typeof grid.canvas;
export interface Viewport {
  width: number;
  height: number;
}

export function viewportFor(canvas: CanvasKey): Viewport {
  return { ...grid.canvas[canvas] };
}

/** Colour token *names* every theme must provide. Themes only supply values for these keys. */
export interface ColorTokens {
  background: string;
  backgroundAlt: string;
  surface: string;
  surfaceStrong: string;
  border: string;
  ink: string;
  inkMuted: string;
  inkSubtle: string;
  inkInverse: string;
  primary: string;
  primaryInk: string;
  accent: string;
  accentInk: string;
  success: string;
  warning: string;
  danger: string;
  overlay: string;
  gradientFrom: string;
  gradientTo: string;
}

export type TokenScalar = string | number;

function flatten(prefix: string, value: unknown, out: Record<string, string>) {
  if (value === null || value === undefined) return;
  if (typeof value === "string" || typeof value === "number") {
    out[prefix] = String(value);
    return;
  }
  if (typeof value === "object") {
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      flatten(`${prefix}-${kebab(key)}`, child, out);
    }
  }
}

function kebab(value: string): string {
  return value.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();
}

/**
 * Turns the token objects above (plus a theme's colours) into a flat `--is-*` custom property map.
 * Numeric tokens that represent lengths get a `px` suffix via `pxTokens`.
 */
export function buildCssVariables(colors: ColorTokens): Record<string, string> {
  const out: Record<string, string> = {};

  for (const [key, value] of Object.entries(spacing)) out[`--is-space-${kebab(key)}`] = `${value}px`;
  for (const [key, value] of Object.entries(radius)) out[`--is-radius-${kebab(key)}`] = `${value}px`;
  for (const [key, value] of Object.entries(borders)) out[`--is-border-${kebab(key)}`] = `${value}px`;
  for (const [key, value] of Object.entries(shadows)) out[`--is-shadow-${kebab(key)}`] = value;
  for (const [key, value] of Object.entries(typography.size)) out[`--is-font-size-${kebab(key)}`] = `${value}px`;
  for (const [key, value] of Object.entries(typography.weight)) out[`--is-font-weight-${kebab(key)}`] = String(value);
  for (const [key, value] of Object.entries(typography.lineHeight)) out[`--is-leading-${kebab(key)}`] = String(value);
  for (const [key, value] of Object.entries(typography.letterSpacing)) out[`--is-tracking-${kebab(key)}`] = String(value);
  out["--is-font-sans"] = typography.fontFamilySans;
  out["--is-font-mono"] = typography.fontFamilyMono;
  out["--is-grid-columns"] = String(grid.columns);
  out["--is-grid-gutter"] = `${grid.gutter}px`;

  flatten("--is-color", colors, out);

  return out;
}

/** Serializes a variable map into a `:root { ... }` CSS block. */
export function cssVariablesBlock(colors: ColorTokens, extra: Record<string, string> = {}): string {
  const vars = { ...buildCssVariables(colors), ...extra };
  const body = Object.entries(vars)
    .map(([name, value]) => `  ${name}: ${value};`)
    .join("\n");
  return `:root {\n${body}\n}`;
}

/** Base reset + primitives shared by every rendered document. Never duplicated per component. */
export const baseCss = `
*, *::before, *::after { box-sizing: border-box; }
html, body { margin: 0; padding: 0; }
body {
  font-family: var(--is-font-sans);
  color: var(--is-color-ink);
  background: var(--is-color-background);
  -webkit-font-smoothing: antialiased;
  text-rendering: geometricPrecision;
}
.is-canvas {
  position: relative;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  background: var(--is-color-background);
}
.is-safe {
  position: relative;
  z-index: 2;
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  min-height: 0;
}
.is-clamp { display: -webkit-box; -webkit-box-orient: vertical; overflow: hidden; }
.is-clamp-1 { -webkit-line-clamp: 1; }
.is-clamp-2 { -webkit-line-clamp: 2; }
.is-clamp-3 { -webkit-line-clamp: 3; }
.is-clamp-4 { -webkit-line-clamp: 4; }
.is-row { display: flex; align-items: center; }
.is-col { display: flex; flex-direction: column; }
.is-spacer { flex: 1 1 auto; }
`;

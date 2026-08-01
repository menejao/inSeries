/**
 * Brand assets as inline SVG / CSS strings. Deliberately geometric placeholders — this ticket is
 * about the rendering architecture, not final brand art. Swapping in real art means editing only
 * this file.
 *
 * Nothing here touches the network: every asset is inline SVG or a CSS gradient.
 */

export type LogoVariant = "light" | "dark" | "mono";

const LOGO_INK: Record<LogoVariant, string> = {
  light: "#F5F5FA",
  dark: "#12121D",
  mono: "currentColor"
};

const LOGO_MARK: Record<LogoVariant, string> = {
  light: "#7C3AED",
  dark: "#5B21B6",
  mono: "currentColor"
};

/** Wordmark + geometric "play/stack" mark. `height` drives the whole lockup. */
export function logoSvg(variant: LogoVariant = "light", height = 56): string {
  const ink = LOGO_INK[variant];
  const mark = LOGO_MARK[variant];
  const width = Math.round(height * 5.4);
  return `<svg viewBox="0 0 270 50" width="${width}" height="${height}" fill="none" aria-hidden="true">
  <rect x="1.5" y="1.5" width="47" height="47" rx="14" fill="${mark}" />
  <path d="M19 15.5v19l15.5-9.5L19 15.5Z" fill="#FFFFFF" />
  <text x="62" y="36" font-family="InSeriesSans, Segoe UI, Arial, sans-serif" font-size="30" font-weight="700" letter-spacing="-0.5" fill="${ink}">inSeries</text>
</svg>`;
}

/** Monochrome mark only (no wordmark) — used by the watermark. */
export function logoMarkSvg(variant: LogoVariant = "light", size = 40): string {
  const mark = LOGO_MARK[variant];
  return `<svg viewBox="0 0 50 50" width="${size}" height="${size}" fill="none" aria-hidden="true">
  <rect x="1.5" y="1.5" width="47" height="47" rx="14" fill="${mark}" />
  <path d="M19 15.5v19l15.5-9.5L19 15.5Z" fill="#FFFFFF" />
</svg>`;
}

export type BackgroundKind = "gradient" | "spotlight" | "mesh" | "flat";

/** CSS `background` value for the canvas. Always token-driven (uses --is-color-* variables). */
export function backgroundCss(kind: BackgroundKind = "gradient"): string {
  switch (kind) {
    case "flat":
      return "var(--is-color-background)";
    case "spotlight":
      return `radial-gradient(120% 80% at 50% 0%, color-mix(in srgb, var(--is-color-gradient-from) 45%, transparent) 0%, var(--is-color-background) 62%), var(--is-color-background)`;
    case "mesh":
      return `radial-gradient(60% 45% at 12% 10%, color-mix(in srgb, var(--is-color-gradient-from) 55%, transparent) 0%, transparent 70%),
radial-gradient(55% 45% at 88% 22%, color-mix(in srgb, var(--is-color-gradient-to) 45%, transparent) 0%, transparent 70%),
radial-gradient(70% 50% at 50% 105%, color-mix(in srgb, var(--is-color-primary) 40%, transparent) 0%, transparent 75%),
var(--is-color-background)`;
    case "gradient":
    default:
      return `linear-gradient(155deg, color-mix(in srgb, var(--is-color-gradient-from) 60%, var(--is-color-background)) 0%, var(--is-color-background) 58%, color-mix(in srgb, var(--is-color-gradient-to) 35%, var(--is-color-background)) 100%)`;
  }
}

/** Subtle repeating pattern layer (diagonal hairlines) — pure CSS, no image files. */
export const patternCss = `repeating-linear-gradient(135deg, rgba(255,255,255,0.035) 0px, rgba(255,255,255,0.035) 2px, transparent 2px, transparent 22px)`;

/** Decorative corner flourish used by story layouts. */
export function decorationSvg(size = 260): string {
  return `<svg viewBox="0 0 200 200" width="${size}" height="${size}" fill="none" aria-hidden="true">
  <circle cx="100" cy="100" r="98" stroke="currentColor" stroke-opacity="0.18" stroke-width="1.5" />
  <circle cx="100" cy="100" r="70" stroke="currentColor" stroke-opacity="0.14" stroke-width="1.5" />
  <circle cx="100" cy="100" r="42" stroke="currentColor" stroke-opacity="0.10" stroke-width="1.5" />
</svg>`;
}

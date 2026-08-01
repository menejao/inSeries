/**
 * Theme Engine — a theme is *only* a set of colour token values plus optional decorative flags.
 * Adding a seasonal theme (halloween/natal/...) is a registry entry, never a component change.
 *
 * Implemented now: `default`, `dark`, `light`.
 * Declared-but-not-implemented (structure ready, `implemented: false`): halloween, natal,
 * ano-novo, recap, black-friday — `resolveTheme()` falls back to `default` for those so nothing
 * ever renders broken, and the fallback is observable via `resolveTheme().fallbackApplied`.
 */
import type { ColorTokens } from "../design-system";

export type ThemeKey =
  | "default"
  | "dark"
  | "light"
  | "halloween"
  | "natal"
  | "ano-novo"
  | "recap"
  | "black-friday";

export interface Theme {
  key: ThemeKey;
  name: string;
  /** false = declared in the registry but with no palette yet; resolveTheme() falls back. */
  implemented: boolean;
  seasonal: boolean;
  colors: ColorTokens;
}

const darkColors: ColorTokens = {
  background: "#0B0B12",
  backgroundAlt: "#12121D",
  surface: "rgba(255,255,255,0.06)",
  surfaceStrong: "rgba(255,255,255,0.12)",
  border: "rgba(255,255,255,0.16)",
  ink: "#F5F5FA",
  inkMuted: "#B9B9CC",
  inkSubtle: "#7C7C93",
  inkInverse: "#0B0B12",
  primary: "#7C3AED",
  primaryInk: "#FFFFFF",
  accent: "#22D3EE",
  accentInk: "#04212B",
  success: "#34D399",
  warning: "#FBBF24",
  danger: "#F87171",
  overlay: "linear-gradient(180deg, rgba(11,11,18,0) 0%, rgba(11,11,18,0.92) 72%)",
  gradientFrom: "#7C3AED",
  gradientTo: "#22D3EE"
};

const lightColors: ColorTokens = {
  background: "#FBFBFE",
  backgroundAlt: "#F1F1F8",
  surface: "rgba(11,11,18,0.04)",
  surfaceStrong: "rgba(11,11,18,0.09)",
  border: "rgba(11,11,18,0.14)",
  ink: "#12121D",
  inkMuted: "#4B4B60",
  inkSubtle: "#7C7C93",
  inkInverse: "#FFFFFF",
  primary: "#5B21B6",
  primaryInk: "#FFFFFF",
  accent: "#0E7490",
  accentInk: "#FFFFFF",
  success: "#047857",
  warning: "#B45309",
  danger: "#B91C1C",
  overlay: "linear-gradient(180deg, rgba(251,251,254,0) 0%, rgba(251,251,254,0.94) 72%)",
  gradientFrom: "#5B21B6",
  gradientTo: "#0E7490"
};

function declared(key: ThemeKey, name: string): Theme {
  return { key, name, implemented: false, seasonal: true, colors: darkColors };
}

export const themeRegistry: Record<ThemeKey, Theme> = {
  default: { key: "default", name: "inSeries (padrao)", implemented: true, seasonal: false, colors: darkColors },
  dark: { key: "dark", name: "Escuro", implemented: true, seasonal: false, colors: darkColors },
  light: { key: "light", name: "Claro", implemented: true, seasonal: false, colors: lightColors },
  halloween: declared("halloween", "Halloween"),
  natal: declared("natal", "Natal"),
  "ano-novo": declared("ano-novo", "Ano Novo"),
  recap: declared("recap", "Recap"),
  "black-friday": declared("black-friday", "Black Friday")
};

export const DEFAULT_THEME: ThemeKey = "default";

export interface ResolvedTheme {
  theme: Theme;
  requested: string;
  fallbackApplied: boolean;
}

/** Never throws: an unknown or not-yet-implemented theme resolves to `default`. */
export function resolveTheme(requested?: string | null): ResolvedTheme {
  const key = (requested ?? DEFAULT_THEME) as ThemeKey;
  const candidate = themeRegistry[key];
  if (candidate && candidate.implemented) {
    return { theme: candidate, requested: key, fallbackApplied: false };
  }
  return { theme: themeRegistry[DEFAULT_THEME], requested: String(requested ?? DEFAULT_THEME), fallbackApplied: true };
}

export function listThemes(): Theme[] {
  return Object.values(themeRegistry);
}

/** Logo variant a theme expects (assets/ exposes light/dark/mono logos). */
export function logoVariantFor(theme: Theme): "light" | "dark" | "mono" {
  return theme.key === "light" ? "dark" : "light";
}

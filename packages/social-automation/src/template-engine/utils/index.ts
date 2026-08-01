/**
 * Pure helpers shared by components/templates. Every function here is total: it must return a
 * usable value for null/undefined/empty input rather than throw, because a missing poster or a
 * null voteAverage is normal data (SeriesSummary has nullable columns) and must never break a render.
 */
import type { SeriesSummary } from "../../content-engine/types";

const ELLIPSIS = "…";

/** HTML-escape — every dynamic string injected into a template literal MUST go through this. */
export function escapeHtml(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Truncate without cutting a word in half when possible: falls back to a hard cut only if the
 * first word alone is longer than `max`.
 */
export function truncate(value: string | null | undefined, max: number): string {
  const text = (value ?? "").trim();
  if (max <= 0) return "";
  if (text.length <= max) return text;

  const slice = text.slice(0, max - 1);
  const lastSpace = slice.lastIndexOf(" ");
  const base = lastSpace > Math.floor(max * 0.5) ? slice.slice(0, lastSpace) : slice;
  return `${base.replace(/[\s,;:.\-]+$/, "")}${ELLIPSIS}`;
}

/** "8.7" / "—" — never NaN, never 10 decimal places. */
export function formatRating(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return (Math.round(value * 10) / 10).toFixed(1);
}

export function hasRating(value: number | null | undefined): boolean {
  return typeof value === "number" && !Number.isNaN(value) && value > 0;
}

export function formatYear(value: number | null | undefined): string {
  if (!value || Number.isNaN(value)) return "—";
  return String(value);
}

export function formatVoteCount(value: number | null | undefined): string {
  if (!value || value <= 0) return "";
  if (value >= 1000) return `${(value / 1000).toFixed(value >= 10000 ? 0 : 1)}k`;
  return String(value);
}

/** First provider, or an honest placeholder. Never invents a platform. */
export function primaryPlatform(series: Pick<SeriesSummary, "watchProviders"> | null | undefined): string | null {
  const providers = series?.watchProviders ?? [];
  return providers.length > 0 ? providers[0] : null;
}

export function topGenres(series: Pick<SeriesSummary, "genres"> | null | undefined, limit = 3): string[] {
  return (series?.genres ?? []).filter(Boolean).slice(0, limit);
}

/** Elegant synopsis fallback — when overview is null we say so instead of rendering an empty box. */
export function synopsisOrPlaceholder(series: Pick<SeriesSummary, "overview" | "genres"> | null | undefined, max = 180): string {
  const overview = series?.overview?.trim();
  if (overview) return truncate(overview, max);
  const genres = topGenres(series, 2);
  if (genres.length > 0) return `Uma serie de ${genres.join(" e ").toLowerCase()} para descobrir agora no inSeries.`;
  return "Sinopse indisponivel — descubra os detalhes completos no inSeries.";
}

/**
 * Deterministic gradient for a poster placeholder, derived from the title so the same series
 * always gets the same colours (stable renders = diffable PNGs).
 */
export function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

export function initialsOf(title: string | null | undefined): string {
  const words = (title ?? "").trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "IN";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return `${words[0][0]}${words[1][0]}`.toUpperCase();
}

/**
 * Posters come from TMDb URLs. The renderer must never depend on the network, so remote posters
 * are only used when `allowRemoteImages` is explicitly enabled by the caller (default: off).
 */
export function resolvePosterUrl(posterUrl: string | null | undefined, allowRemoteImages: boolean): string | null {
  if (!allowRemoteImages) return null;
  if (!posterUrl) return null;
  if (!/^https?:\/\//i.test(posterUrl)) return null;
  return posterUrl;
}

/** Alt text generator — one description per generated image, derived only from payload data. */
export function buildAltText(input: {
  title: string;
  format: "feed" | "story" | "carousel";
  slideIndex?: number;
  slideTotal?: number;
  series?: Array<Pick<SeriesSummary, "title">>;
}): string {
  const label = input.format === "feed" ? "Post de feed" : input.format === "story" ? "Story" : "Slide de carrossel";
  const position =
    input.format === "carousel" && input.slideIndex && input.slideTotal ? ` ${input.slideIndex} de ${input.slideTotal}` : "";
  const titles = (input.series ?? []).map((s) => s.title).filter(Boolean);
  const seriesPart = titles.length > 0 ? ` Series citadas: ${titles.slice(0, 6).join(", ")}.` : "";
  return `${label}${position} do inSeries: ${input.title}.${seriesPart}`.replace(/\s+/g, " ").trim();
}

/** Chunk `items` into slides while preserving order. */
export function chunk<T>(items: T[], size: number): T[][] {
  if (size <= 0) return [items];
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}
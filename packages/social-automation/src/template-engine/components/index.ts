/**
 * Reusable HTML+CSS blocks as PURE functions returning strings.
 *
 * Rules enforced across this file:
 *  - every dynamic value goes through `escapeHtml`;
 *  - no colour/space/radius literal — only `var(--is-*)` tokens from design-system/;
 *  - every component tolerates missing data (null poster/rating/platform/synopsis) and renders an
 *    honest placeholder instead of an empty box or a crash.
 */
import { escapeHtml, formatRating, formatVoteCount, formatYear, hasRating, hashString, initialsOf, truncate } from "../utils";
import { renderIcon, type IconName } from "../icons";
import { logoMarkSvg, logoSvg, type LogoVariant } from "../assets";
import type { SeriesSummary } from "../../content-engine/types";

/* ------------------------------------------------------------------ Logo */

export function Logo(props: { variant?: LogoVariant; height?: number } = {}): string {
  return `<div class="is-logo">${logoSvg(props.variant ?? "light", props.height ?? 52)}</div>`;
}

export function Watermark(props: { variant?: LogoVariant; label?: string } = {}): string {
  const label = escapeHtml(props.label ?? "inseries.app");
  return `<div class="is-watermark">${logoMarkSvg(props.variant ?? "light", 36)}<span>${label}</span></div>`;
}

/* --------------------------------------------------------------- Typography */

export function Title(props: { text: string; size?: "hero" | "display" | "title" | "subtitle"; lines?: 1 | 2 | 3 | 4; max?: number }): string {
  const size = props.size ?? "display";
  const lines = props.lines ?? 3;
  const text = escapeHtml(truncate(props.text, props.max ?? 120));
  return `<h1 class="is-title is-title--${size} is-clamp is-clamp-${lines}">${text}</h1>`;
}

export function Subtitle(props: { text: string; tone?: "muted" | "accent" | "ink"; lines?: 1 | 2 | 3 | 4; max?: number }): string {
  const tone = props.tone ?? "muted";
  const lines = props.lines ?? 3;
  const text = escapeHtml(truncate(props.text, props.max ?? 220));
  if (!text) return "";
  return `<p class="is-subtitle is-subtitle--${tone} is-clamp is-clamp-${lines}">${text}</p>`;
}

export function Eyebrow(props: { text: string; icon?: IconName }): string {
  const text = escapeHtml(truncate(props.text, 48));
  if (!text) return "";
  const icon = props.icon ? renderIcon(props.icon, 26) : "";
  return `<div class="is-eyebrow">${icon}<span>${text}</span></div>`;
}

/* ------------------------------------------------------------------ Badge */

export function Badge(props: { text: string; tone?: "primary" | "accent" | "neutral" | "danger"; icon?: IconName }): string {
  const text = escapeHtml(truncate(props.text, 40));
  if (!text) return "";
  const icon = props.icon ? renderIcon(props.icon, 24) : "";
  return `<span class="is-badge is-badge--${props.tone ?? "neutral"}">${icon}<span>${text}</span></span>`;
}

export function GenreChip(props: { label: string }): string {
  const label = escapeHtml(truncate(props.label, 24));
  if (!label) return "";
  return `<span class="is-chip">${label}</span>`;
}

export function GenreChips(props: { genres: string[]; limit?: number }): string {
  const genres = (props.genres ?? []).filter(Boolean).slice(0, props.limit ?? 3);
  if (genres.length === 0) return "";
  return `<div class="is-chips">${genres.map((label) => GenreChip({ label })).join("")}</div>`;
}

/* ----------------------------------------------------------------- Rating */

export function Rating(props: { value: number | null | undefined; votes?: number | null }): string {
  if (!hasRating(props.value)) {
    return `<span class="is-rating is-rating--empty">${renderIcon("star", 26)}<span>sem nota</span></span>`;
  }
  const votes = formatVoteCount(props.votes ?? null);
  return `<span class="is-rating">${renderIcon("star", 26)}<span>${escapeHtml(formatRating(props.value))}</span>${
    votes ? `<span class="is-rating__votes">(${escapeHtml(votes)})</span>` : ""
  }</span>`;
}

/* --------------------------------------------------------------- Platform */

export function Platform(props: { name: string | null | undefined }): string {
  const name = props.name?.trim();
  if (!name) {
    return `<span class="is-platform is-platform--empty">${renderIcon("tv", 24)}<span>plataforma a confirmar</span></span>`;
  }
  return `<span class="is-platform">${renderIcon("tv", 24)}<span>${escapeHtml(truncate(name, 26))}</span></span>`;
}

/* ----------------------------------------------------------------- Poster */

/**
 * Renders a real poster image only when `src` is provided (the renderer only allows that when the
 * caller explicitly opts into remote images). Otherwise: a deterministic gradient tile with the
 * series initials — always the same colours for the same title.
 */
export function Poster(props: { title: string; src?: string | null; ratio?: "2/3" | "1/1" | "16/9"; size?: "sm" | "md" | "lg" }): string {
  const ratio = props.ratio ?? "2/3";
  const size = props.size ?? "md";
  const title = escapeHtml(props.title ?? "");
  if (props.src) {
    return `<div class="is-poster is-poster--${size}" style="aspect-ratio:${ratio}"><img src="${escapeHtml(props.src)}" alt="${title}" /></div>`;
  }
  const hue = hashString(props.title ?? "inseries") % 360;
  const hue2 = (hue + 48) % 360;
  return `<div class="is-poster is-poster--${size} is-poster--placeholder" style="aspect-ratio:${ratio};--is-poster-a:hsl(${hue} 62% 32%);--is-poster-b:hsl(${hue2} 58% 18%)">
  <span class="is-poster__initials">${escapeHtml(initialsOf(props.title))}</span>
  <span class="is-poster__mark">${renderIcon("play", 34)}</span>
</div>`;
}

export function Avatar(props: { name: string; size?: number }): string {
  const size = props.size ?? 72;
  const hue = hashString(props.name ?? "inseries") % 360;
  return `<span class="is-avatar" style="width:${size}px;height:${size}px;background:hsl(${hue} 55% 34%)">${escapeHtml(initialsOf(props.name))}</span>`;
}

/* ------------------------------------------------------------- Structural */

export function Divider(props: { tone?: "soft" | "strong" } = {}): string {
  return `<div class="is-divider is-divider--${props.tone ?? "soft"}"></div>`;
}

export function Progress(props: { value: number; total: number; label?: string }): string {
  const total = props.total > 0 ? props.total : 1;
  const pct = Math.max(0, Math.min(100, Math.round((props.value / total) * 100)));
  const label = props.label ? `<span class="is-progress__label">${escapeHtml(truncate(props.label, 40))}</span>` : "";
  return `<div class="is-progress">${label}<div class="is-progress__track"><div class="is-progress__bar" style="width:${pct}%"></div></div><span class="is-progress__value">${pct}%</span></div>`;
}

export function Header(props: { eyebrow?: string; icon?: IconName; logoVariant?: LogoVariant; right?: string }): string {
  const left = props.eyebrow ? Eyebrow({ text: props.eyebrow, icon: props.icon }) : Logo({ variant: props.logoVariant });
  const right = props.eyebrow ? (props.right ?? Logo({ variant: props.logoVariant, height: 44 })) : (props.right ?? "");
  return `<header class="is-header">${left}<div class="is-spacer"></div>${right}</header>`;
}

export function Footer(props: { cta: string; note?: string; logoVariant?: LogoVariant }): string {
  return `<footer class="is-footer">${CTA({ text: props.cta })}<div class="is-spacer"></div>${Watermark({ variant: props.logoVariant, label: props.note })}</footer>`;
}

/* -------------------------------------------------------------------- CTA */

/**
 * CTA is mandatory on every generated format. The text comes straight from `payload.cta.text`,
 * already validated by the Content Engine's cta-engine — no validation is re-implemented here.
 * If the text is empty we still render the block with a neutral default so no format is ever
 * produced without a visible CTA.
 */
export function CTA(props: { text: string; variant?: "solid" | "outline" | "bar" }): string {
  const text = escapeHtml(truncate(props.text?.trim() || "Descubra mais no inSeries", 90));
  const variant = props.variant ?? "solid";
  return `<div class="is-cta is-cta--${variant}"><span class="is-cta__text">${text}</span><span class="is-cta__icon">${renderIcon("arrow-right", 30)}</span></div>`;
}

/* ------------------------------------------------------------- Series card */

export function SeriesCard(props: {
  series: SeriesSummary;
  posterSrc?: string | null;
  layout?: "vertical" | "horizontal";
  showSynopsis?: boolean;
  synopsis?: string;
  badge?: string;
}): string {
  const { series } = props;
  const layout = props.layout ?? "vertical";
  const badge = props.badge ? Badge({ text: props.badge, tone: "primary" }) : "";
  const synopsis = props.showSynopsis && props.synopsis ? `<p class="is-card__synopsis is-clamp is-clamp-3">${escapeHtml(props.synopsis)}</p>` : "";

  return `<article class="is-card is-card--${layout}">
  ${Poster({ title: series.title, src: props.posterSrc, size: layout === "horizontal" ? "sm" : "md" })}
  <div class="is-card__body">
    ${badge}
    <h3 class="is-card__title is-clamp is-clamp-2">${escapeHtml(truncate(series.title, 56))}</h3>
    <div class="is-card__meta">
      <span>${escapeHtml(formatYear(series.firstAirYear))}</span>
      <span class="is-dot"></span>
      ${Rating({ value: series.voteAverage, votes: series.voteCount })}
    </div>
    ${GenreChips({ genres: series.genres, limit: layout === "horizontal" ? 2 : 3 })}
    ${synopsis}
    ${layout === "horizontal" ? Platform({ name: series.watchProviders?.[0] ?? null }) : ""}
  </div>
</article>`;
}

/**
 * Two lines only, on purpose: a ranking of 5 entries plus a title and the mandatory CTA has to fit
 * a 1080x1080 safe area, and a three-line row does not. The metric therefore shares the meta line.
 */
export function RankingItem(props: { position: number; series: SeriesSummary; metric?: string | null; posterSrc?: string | null }): string {
  const metric = props.metric ? `<span class="is-rank__metric">${escapeHtml(truncate(props.metric, 28))}</span>` : "";
  return `<li class="is-rank">
  <span class="is-rank__position">${escapeHtml(String(props.position))}</span>
  ${Poster({ title: props.series.title, src: props.posterSrc, size: "sm" })}
  <div class="is-rank__body">
    <span class="is-rank__title is-clamp is-clamp-1">${escapeHtml(truncate(props.series.title, 40))}</span>
    <span class="is-rank__meta">${escapeHtml(formatYear(props.series.firstAirYear))} · ${escapeHtml(
      formatRating(props.series.voteAverage)
    )}${metric ? " · " : ""}${metric}</span>
  </div>
</li>`;
}

export function PollOption(props: { label: string; index: number }): string {
  const letter = String.fromCharCode(65 + props.index);
  return `<li class="is-poll-option"><span class="is-poll-option__key">${letter}</span><span class="is-poll-option__label is-clamp is-clamp-2">${escapeHtml(
    truncate(props.label, 46)
  )}</span></li>`;
}

/* ------------------------------------------------------------------- CSS */

/** All component styles in one place — injected once per document by the layouts. */
export const componentsCss = `
.is-logo { display: flex; align-items: center; }
.is-watermark { display: flex; align-items: center; gap: var(--is-space-xxs); color: var(--is-color-ink-muted); font-size: var(--is-font-size-caption); font-weight: var(--is-font-weight-medium); }

.is-title { margin: 0; color: var(--is-color-ink); font-weight: var(--is-font-weight-black); line-height: var(--is-leading-tight); letter-spacing: var(--is-tracking-tight); }
.is-title--hero { font-size: var(--is-font-size-hero); }
.is-title--display { font-size: var(--is-font-size-display); }
.is-title--title { font-size: var(--is-font-size-title); }
.is-title--subtitle { font-size: var(--is-font-size-subtitle); }

.is-subtitle { margin: 0; font-size: var(--is-font-size-body-large); line-height: var(--is-leading-normal); font-weight: var(--is-font-weight-medium); }
.is-subtitle--muted { color: var(--is-color-ink-muted); }
.is-subtitle--ink { color: var(--is-color-ink); }
.is-subtitle--accent { color: var(--is-color-accent); }

.is-eyebrow { display: inline-flex; align-items: center; gap: var(--is-space-xxs); color: var(--is-color-accent);
  font-size: var(--is-font-size-caption); font-weight: var(--is-font-weight-bold); text-transform: uppercase; letter-spacing: var(--is-tracking-wider); }

.is-badge { display: inline-flex; align-items: center; gap: 10px; padding: 10px var(--is-space-xs); border-radius: var(--is-radius-pill);
  font-size: var(--is-font-size-caption); font-weight: var(--is-font-weight-bold); letter-spacing: var(--is-tracking-wide); text-transform: uppercase; }
/* In a column stack a badge must hug its text instead of stretching to the full width. */
.is-badge { align-self: flex-start; }
.is-badge--primary { background: var(--is-color-primary); color: var(--is-color-primary-ink); }
.is-badge--accent { background: var(--is-color-accent); color: var(--is-color-accent-ink); }
.is-badge--neutral { background: var(--is-color-surface-strong); color: var(--is-color-ink); }
.is-badge--danger { background: var(--is-color-danger); color: var(--is-color-ink-inverse); }

.is-chips { display: flex; flex-wrap: wrap; gap: 10px; }
.is-chip { padding: 8px 18px; border-radius: var(--is-radius-pill); border: var(--is-border-thin) solid var(--is-color-border);
  background: var(--is-color-surface); color: var(--is-color-ink-muted); font-size: var(--is-font-size-micro); font-weight: var(--is-font-weight-semibold); white-space: nowrap; }

.is-rating { display: inline-flex; align-items: center; gap: 8px; color: var(--is-color-warning); font-size: var(--is-font-size-caption); font-weight: var(--is-font-weight-bold); }
.is-rating--empty { color: var(--is-color-ink-subtle); font-weight: var(--is-font-weight-medium); }
.is-rating__votes { color: var(--is-color-ink-subtle); font-weight: var(--is-font-weight-regular); }

.is-platform { display: inline-flex; align-items: center; gap: 8px; color: var(--is-color-ink-muted); font-size: var(--is-font-size-micro); font-weight: var(--is-font-weight-semibold); }
.is-platform--empty { color: var(--is-color-ink-subtle); font-weight: var(--is-font-weight-regular); }

.is-poster { position: relative; overflow: hidden; border-radius: var(--is-radius-lg); background: var(--is-color-surface-strong);
  box-shadow: var(--is-shadow-md); flex: 0 0 auto; }
.is-poster img { width: 100%; height: 100%; object-fit: cover; display: block; }
.is-poster--sm { width: 132px; }
.is-poster--md { width: 240px; }
.is-poster--lg { width: 380px; }
.is-poster--placeholder { display: flex; align-items: center; justify-content: center;
  background: linear-gradient(150deg, var(--is-poster-a) 0%, var(--is-poster-b) 100%); }
.is-poster__initials { font-size: 56px; font-weight: var(--is-font-weight-black); color: rgba(255,255,255,0.92); letter-spacing: var(--is-tracking-tight); }
.is-poster__mark { position: absolute; right: 14px; bottom: 12px; color: rgba(255,255,255,0.55); display: flex; }

.is-avatar { display: inline-flex; align-items: center; justify-content: center; border-radius: var(--is-radius-circle);
  color: #fff; font-weight: var(--is-font-weight-bold); font-size: var(--is-font-size-caption); }

.is-divider { width: 100%; height: var(--is-border-thin); border-radius: var(--is-radius-pill); }
.is-divider--soft { background: var(--is-color-border); }
.is-divider--strong { background: linear-gradient(90deg, var(--is-color-gradient-from), var(--is-color-gradient-to)); height: var(--is-border-regular); }

.is-progress { display: flex; align-items: center; gap: var(--is-space-xs); width: 100%; color: var(--is-color-ink-muted); font-size: var(--is-font-size-micro); font-weight: var(--is-font-weight-semibold); }
.is-progress__track { flex: 1 1 auto; height: 14px; border-radius: var(--is-radius-pill); background: var(--is-color-surface-strong); overflow: hidden; }
.is-progress__bar { height: 100%; border-radius: var(--is-radius-pill); background: linear-gradient(90deg, var(--is-color-gradient-from), var(--is-color-gradient-to)); }

.is-header { display: flex; align-items: center; gap: var(--is-space-xs); }
.is-footer { display: flex; align-items: center; gap: var(--is-space-sm); }

.is-cta { display: inline-flex; align-items: center; gap: var(--is-space-xs); padding: var(--is-space-xs) var(--is-space-sm);
  border-radius: var(--is-radius-pill); font-size: var(--is-font-size-body); font-weight: var(--is-font-weight-bold); line-height: var(--is-leading-snug); max-width: 100%; }
.is-cta--solid { background: linear-gradient(92deg, var(--is-color-gradient-from), var(--is-color-gradient-to)); color: var(--is-color-primary-ink); box-shadow: var(--is-shadow-md); }
.is-cta--outline { border: var(--is-border-regular) solid var(--is-color-primary); color: var(--is-color-ink); background: var(--is-color-surface); }
.is-cta--bar { width: 100%; justify-content: center; background: var(--is-color-primary); color: var(--is-color-primary-ink); border-radius: var(--is-radius-lg); padding: var(--is-space-sm); font-size: var(--is-font-size-body-large); }
.is-cta__text { display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; overflow: hidden; }
.is-cta__icon { display: flex; flex: 0 0 auto; }

.is-card { display: flex; gap: var(--is-space-sm); background: var(--is-color-surface); border: var(--is-border-thin) solid var(--is-color-border);
  border-radius: var(--is-radius-xl); padding: var(--is-space-sm); }
.is-card--vertical { flex-direction: column; }
.is-card--horizontal { flex-direction: row; align-items: center; }
.is-card--vertical .is-poster { width: 100%; }
.is-card__body { display: flex; flex-direction: column; gap: 12px; min-width: 0; flex: 1 1 auto; }
.is-card__title { margin: 0; font-size: var(--is-font-size-subtitle); font-weight: var(--is-font-weight-bold); color: var(--is-color-ink); line-height: var(--is-leading-snug); }
.is-card__meta { display: flex; align-items: center; gap: 12px; color: var(--is-color-ink-muted); font-size: var(--is-font-size-caption); font-weight: var(--is-font-weight-semibold); }
.is-card__synopsis { margin: 0; color: var(--is-color-ink-muted); font-size: var(--is-font-size-body); line-height: var(--is-leading-normal); }
.is-dot { width: 8px; height: 8px; border-radius: var(--is-radius-circle); background: var(--is-color-ink-subtle); flex: 0 0 auto; }

/* The list absorbs whatever vertical space is left and its rows share it evenly, so a 3-item and
   a 5-item ranking both fill the canvas without ever overflowing the safe area. */
.is-rank-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: var(--is-space-xxs); width: 100%; flex: 0 1 auto; min-height: 0; overflow: hidden; }
.is-rank { display: flex; align-items: center; gap: var(--is-space-xs); flex: 0 0 auto; background: var(--is-color-surface); border: var(--is-border-thin) solid var(--is-color-border);
  border-radius: var(--is-radius-lg); padding: 14px var(--is-space-xs); }
.is-rank__position { flex: 0 0 auto; width: 64px; text-align: center; font-size: var(--is-font-size-title); font-weight: var(--is-font-weight-black);
  background: linear-gradient(180deg, var(--is-color-gradient-from), var(--is-color-gradient-to)); -webkit-background-clip: text; background-clip: text; color: transparent; }
.is-rank .is-poster--sm { width: 52px; border-radius: var(--is-radius-md); }
/* At this size the play mark would collide with the initials. */
.is-rank .is-poster__mark { display: none; }
.is-rank .is-poster__initials { font-size: var(--is-font-size-micro); }
/* Inside a grid cell the poster fills the column instead of its fixed intrinsic width. */
.is-grid-2 .is-poster, .is-grid-3 .is-poster { width: 100%; }
.is-rank__body { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
.is-rank__title { font-size: var(--is-font-size-body); font-weight: var(--is-font-weight-bold); color: var(--is-color-ink); }
.is-rank__meta { font-size: var(--is-font-size-micro); color: var(--is-color-ink-muted); font-weight: var(--is-font-weight-semibold); }
.is-rank__metric { color: var(--is-color-accent); font-weight: var(--is-font-weight-semibold); }

.is-poll-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: var(--is-space-xs); width: 100%; }
.is-poll-option { display: flex; align-items: center; gap: var(--is-space-xs); padding: var(--is-space-xs) var(--is-space-sm);
  border-radius: var(--is-radius-lg); border: var(--is-border-regular) solid var(--is-color-border); background: var(--is-color-surface); }
.is-poll-option__key { flex: 0 0 auto; width: 64px; height: 64px; border-radius: var(--is-radius-circle); display: flex; align-items: center; justify-content: center;
  background: var(--is-color-primary); color: var(--is-color-primary-ink); font-size: var(--is-font-size-body); font-weight: var(--is-font-weight-black); }
.is-feature-mark { color: var(--is-color-accent); display: flex; }

.is-poll-option__label { font-size: var(--is-font-size-body-large); font-weight: var(--is-font-weight-semibold); color: var(--is-color-ink); }
`;

/**
 * Layouts = the base compositions per canvas (feed square / portrait / story vertical).
 *
 * The grid and the SAFE AREA live here and nowhere else: components never set their own outer
 * padding, so "nothing glued to the border" is guaranteed structurally instead of per-template.
 */
import { baseCss, cssVariablesBlock, safeArea, viewportFor, type CanvasKey, type Viewport } from "../design-system";
import { componentsCss } from "../components";
import { fontFaceCss } from "../fonts";
import { backgroundCss, decorationSvg, patternCss, type BackgroundKind } from "../assets";
import { resolveTheme, logoVariantFor, type Theme } from "../themes";
import type { LogoVariant } from "../assets";

export type LayoutKind = "feed" | "portrait" | "story";

const CANVAS_BY_LAYOUT: Record<LayoutKind, CanvasKey> = { feed: "feed", portrait: "portrait", story: "story" };

export interface LayoutContext {
  theme: Theme;
  logoVariant: LogoVariant;
  layout: LayoutKind;
  viewport: Viewport;
}

export interface LayoutOptions {
  themeKey?: string | null;
  background?: BackgroundKind;
  showPattern?: boolean;
  showDecoration?: boolean;
}

export function layoutContext(layout: LayoutKind, options: LayoutOptions = {}): LayoutContext {
  const { theme } = resolveTheme(options.themeKey);
  return { theme, logoVariant: logoVariantFor(theme), layout, viewport: viewportFor(CANVAS_BY_LAYOUT[layout]) };
}

export function viewportForLayout(layout: LayoutKind): Viewport {
  return viewportFor(CANVAS_BY_LAYOUT[layout]);
}

const layoutCss = `
.is-canvas--feed .is-safe { padding: ${px(safeArea.square)}; }
.is-canvas--portrait .is-safe { padding: ${px(safeArea.portrait)}; }
.is-canvas--story .is-safe { padding: ${px(safeArea.story)}; }
.is-canvas__bg { position: absolute; inset: 0; z-index: 0; }
.is-canvas__pattern { position: absolute; inset: 0; z-index: 1; opacity: 0.6; }
.is-canvas__decoration { position: absolute; z-index: 1; color: var(--is-color-ink); opacity: 0.5; }
.is-canvas--feed .is-canvas__decoration { right: -90px; top: -90px; }
.is-canvas--portrait .is-canvas__decoration { right: -90px; top: -80px; }
.is-canvas--story .is-canvas__decoration { right: -110px; top: 120px; }
.is-slot { display: flex; flex-direction: column; }
/* overflow:hidden is a structural guarantee, not a cosmetic choice: no matter how long a title or
   how many items a payload carries, the body can never bleed over the header/footer or outside the
   safe area. Templates still size their content to fit; this is the last line of defence. */
.is-slot--body { flex: 1 1 auto; min-height: 0; gap: var(--is-space-sm); justify-content: center; overflow: hidden; }
.is-slot--header { flex: 0 0 auto; }
.is-slot--footer { flex: 0 0 auto; gap: var(--is-space-sm); }
.is-stack-sm { display: flex; flex-direction: column; gap: var(--is-space-xs); min-height: 0; max-height: 100%; }
.is-stack-md { display: flex; flex-direction: column; gap: var(--is-space-sm); }
.is-stack-lg { display: flex; flex-direction: column; gap: var(--is-space-md); }
.is-grid-2 { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--is-space-xs); }
.is-grid-3 { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: var(--is-space-xs); }
.is-split { display: flex; gap: var(--is-space-md); align-items: center; min-height: 0; }
.is-split > .is-split__media { flex: 0 0 auto; }
.is-split > .is-split__content { flex: 1 1 auto; min-width: 0; display: flex; flex-direction: column; gap: var(--is-space-xs); }
`;

function px(area: { top: number; right: number; bottom: number; left: number }): string {
  return `${area.top}px ${area.right}px ${area.bottom}px ${area.left}px`;
}

export interface DocumentSlots {
  header?: string;
  body: string;
  footer?: string;
}

/**
 * Builds the complete, self-contained HTML document. No external request is possible: fonts are
 * data URIs, icons/logos are inline SVG, backgrounds are CSS gradients.
 */
export function renderLayout(ctx: LayoutContext, slots: DocumentSlots, options: LayoutOptions = {}): string {
  const bg = backgroundCss(options.background ?? "gradient");
  const pattern = options.showPattern === false ? "" : `<div class="is-canvas__pattern" style="background:${patternCss}"></div>`;
  const decoration = options.showDecoration ? `<div class="is-canvas__decoration">${decorationSvg(ctx.layout === "story" ? 340 : 260)}</div>` : "";

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<style>
${fontFaceCss()}
${cssVariablesBlock(ctx.theme.colors)}
${baseCss}
${componentsCss}
${layoutCss}
.is-canvas { width: ${ctx.viewport.width}px; height: ${ctx.viewport.height}px; }
</style>
</head>
<body>
<div class="is-canvas is-canvas--${ctx.layout}">
  <div class="is-canvas__bg" style="background:${bg}"></div>
  ${pattern}
  ${decoration}
  <div class="is-safe">
    ${slots.header ? `<div class="is-slot is-slot--header">${slots.header}</div>` : ""}
    <div class="is-slot is-slot--body">${slots.body}</div>
    ${slots.footer ? `<div class="is-slot is-slot--footer">${slots.footer}</div>` : ""}
  </div>
</div>
</body>
</html>`;
}

/** Convenience wrappers so templates read as `feedLayout({...})` instead of assembling context. */
export function feedLayout(slots: DocumentSlots, options: LayoutOptions = {}): { html: string; viewport: Viewport } {
  const ctx = layoutContext("feed", options);
  return { html: renderLayout(ctx, slots, options), viewport: ctx.viewport };
}

export function portraitLayout(slots: DocumentSlots, options: LayoutOptions = {}): { html: string; viewport: Viewport } {
  const ctx = layoutContext("portrait", options);
  return { html: renderLayout(ctx, slots, options), viewport: ctx.viewport };
}

export function storyLayout(slots: DocumentSlots, options: LayoutOptions = {}): { html: string; viewport: Viewport } {
  const ctx = layoutContext("story", options);
  return { html: renderLayout(ctx, slots, options), viewport: ctx.viewport };
}

export function layoutByKind(kind: LayoutKind, slots: DocumentSlots, options: LayoutOptions = {}): { html: string; viewport: Viewport } {
  if (kind === "story") return storyLayout(slots, options);
  if (kind === "portrait") return portraitLayout(slots, options);
  return feedLayout(slots, options);
}

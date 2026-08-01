/**
 * Helpers shared by the 8 template files. Nothing here decides *what* to publish — it only
 * reshapes the already-built `ContentPayload` into layout slots.
 */
import { CTA, Footer, Header, Subtitle, Title, Watermark } from "../components";
import { storyLayout, type LayoutOptions } from "../layouts";
import { escapeHtml, resolvePosterUrl, truncate } from "../utils";
import { resolveCtaVisual, CTA_HEADLINE_MAX, CTA_BODY_MAX, type CtaVisual } from "../cta-visual";
import { TemplateEngineError, type RenderableDocument, type TemplateBuildContext } from "../types";
import type { IconName } from "../icons";
import type { ContentPayload, SeriesSummary } from "../../content-engine/types";

/**
 * Payload contract check. Templates FAIL LOUDLY (TemplateEngineError) on a structurally invalid
 * payload — a missing title/cta means the Content Engine produced something unpublishable and
 * silently rendering a blank image would be worse. Missing *optional* data (poster, rating,
 * platform, synopsis, empty items) is NOT invalid: components fall back to placeholders.
 */
export function assertPayload(payload: ContentPayload | null | undefined, templateKey: string): ContentPayload {
  if (!payload || typeof payload !== "object") {
    throw new TemplateEngineError(`template "${templateKey}": payload ausente ou invalido.`);
  }
  if (!payload.title || typeof payload.title !== "string") {
    throw new TemplateEngineError(`template "${templateKey}": payload.title ausente — nao e possivel compor a arte.`);
  }
  if (!payload.cta || typeof payload.cta.text !== "string") {
    throw new TemplateEngineError(`template "${templateKey}": payload.cta.text ausente — todo formato exige CTA visivel.`);
  }
  if (!Array.isArray(payload.items)) {
    throw new TemplateEngineError(`template "${templateKey}": payload.items deve ser um array.`);
  }
  return payload;
}

/** All series in the payload, primary first — the shape most templates actually want. */
export function allSeries(payload: ContentPayload): SeriesSummary[] {
  return [payload.sourceSeries, ...payload.items].filter((s): s is SeriesSummary => Boolean(s));
}

export function poster(ctx: TemplateBuildContext, series: SeriesSummary | null | undefined): string | null {
  return resolvePosterUrl(series?.posterUrl, ctx.allowRemoteImages);
}

export function layoutOptions(ctx: TemplateBuildContext, extra: LayoutOptions = {}): LayoutOptions {
  return { themeKey: ctx.themeKey, background: "gradient", ...extra };
}

export function header(eyebrow: string, icon: IconName): string {
  return Header({ eyebrow, icon });
}

/** Derivacao visual do CTA (headline/body/action) — ver cta-visual.ts. */
export function ctaVisual(payload: ContentPayload, templateKey?: string): CtaVisual {
  return resolveCtaVisual(payload, templateKey);
}

/**
 * Rodape do FEED. Feed e post unico: a arte leva apenas a chamada curta (headline) + o rotulo do
 * botao (action). O CTA editorial completo continua exclusivamente na legenda — assim o mesmo
 * paragrafo nunca aparece duas vezes.
 */
export function footer(payload: ContentPayload, templateKey?: string): string {
  const cta = ctaVisual(payload, templateKey);
  return `<div class="is-stack-sm">${Subtitle({ text: cta.headline, tone: "accent", lines: 1, max: CTA_HEADLINE_MAX })}${Footer({
    cta: cta.action
  })}</div>`;
}

/**
 * Bloco de CTA das artes que tem espaco para as tres areas (story e slide final de carrossel):
 * headline curta, corpo com o CTA editorial e botao curto — tres textos distintos por construcao.
 */
export function ctaBlock(cta: CtaVisual): string {
  return `<div class="is-stack-sm">
    ${Subtitle({ text: cta.headline, tone: "accent", lines: 1, max: CTA_HEADLINE_MAX })}
    ${Subtitle({ text: cta.body, tone: "muted", lines: 2, max: CTA_BODY_MAX })}
    ${CTA({ text: cta.action, variant: "bar" })}
  </div>`;
}

/** String of the payload's first hashtags, used as a discreet footer note on stories. */
export function hashtagLine(payload: ContentPayload, limit = 3): string {
  const tags = (payload.hashtags ?? []).slice(0, limit);
  if (tags.length === 0) return "";
  return `<p class="is-subtitle is-subtitle--accent">${escapeHtml(tags.join("  "))}</p>`;
}

export interface StoryTeaserInput {
  eyebrow: string;
  icon: IconName;
  headline: string;
  support?: string;
  /** Extra HTML rendered between the headline and the CTA (e.g. a poster or a mini list). */
  content?: string;
}

/**
 * THE story teaser layout — deliberately its own composition (short headline, big CTA bar,
 * vertical rhythm), never a resized feed. Every template routes its story through this so the
 * teaser look is consistent across the whole account.
 */
export function storyTeaser(ctx: TemplateBuildContext, input: StoryTeaserInput): RenderableDocument {
  const payload = ctx.payload;
  const { html, viewport } = storyLayout(
    {
      header: header(input.eyebrow, input.icon),
      body: `<div class="is-stack-md">
        ${Title({ text: truncate(input.headline, 90), size: "display", lines: 4 })}
        ${input.support ? Subtitle({ text: input.support, lines: 3, max: 150 }) : ""}
        ${input.content ?? ""}
      </div>`,
      footer: `<div class="is-stack-sm">${ctaBlock(ctaVisual(payload))}${hashtagLine(payload)}${Watermark({})}</div>`
    },
    layoutOptions(ctx, { background: "mesh", showDecoration: true })
  );
  return { html, viewport, slideKey: "story" };
}

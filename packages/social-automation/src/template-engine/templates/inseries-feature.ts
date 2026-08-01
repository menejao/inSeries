import { Badge, Divider, Subtitle, Title, Watermark } from "../components";
import { feedLayout } from "../layouts";
import { escapeHtml, truncate } from "../utils";
import { renderIcon } from "../icons";
import { logoSvg } from "../assets";
import { assertPayload, footer, header, layoutOptions, storyTeaser } from "./_shared";
import type { RenderableDocument, SocialTemplate, TemplateBuildContext } from "../types";
import type { ContentPayload } from "../../content-engine/types";

function featureTitle(payload: ContentPayload): string {
  const value = typeof payload.extra?.featureTitle === "string" ? payload.extra.featureTitle.trim() : "";
  return value || payload.title;
}

function featureDescription(payload: ContentPayload): string {
  const value = typeof payload.extra?.featureDescription === "string" ? payload.extra.featureDescription.trim() : "";
  return value || payload.hook;
}

/**
 * Recurso do inSeries — post de produto, sem series envolvidas (payload.items e sempre vazio
 * neste formato). Composicao propria: marca grande, nome do recurso, descricao e CTA.
 */
export const inseriesFeatureTemplate: SocialTemplate = {
  key: "inseries-feature",

  buildFeed(ctx: TemplateBuildContext): RenderableDocument {
    const payload = assertPayload(ctx.payload, "inseries-feature");

    const body = `<div class="is-stack-md" style="align-items:flex-start">
      ${Badge({ text: "Recurso do inSeries", tone: "primary", icon: "sparkles" })}
      <div class="is-feature-mark">${renderIcon("sparkles", 96)}</div>
      ${Title({ text: featureTitle(payload), size: "display", lines: 3, max: 80 })}
      ${Divider({ tone: "strong" })}
      ${Subtitle({ text: featureDescription(payload), lines: 4, max: 220 })}
    </div>`;

    const { html, viewport } = feedLayout(
      { header: header("inSeries", "sparkles"), body, footer: footer(payload) },
      layoutOptions(ctx, { background: "mesh", showDecoration: true })
    );
    return { html, viewport, slideKey: "feed" };
  },

  buildStory(ctx: TemplateBuildContext): RenderableDocument {
    const payload = assertPayload(ctx.payload, "inseries-feature");
    return storyTeaser(ctx, {
      eyebrow: "Recurso do inSeries",
      icon: "sparkles",
      headline: truncate(featureTitle(payload), 80),
      support: featureDescription(payload),
      content: `<div class="is-row" style="gap:var(--is-space-xs)">${logoSvg("light", 56)}</div>
        <p class="is-subtitle is-subtitle--muted">${escapeHtml("Disponivel agora no app.")}</p>
        ${Watermark({})}`
    });
  }
};

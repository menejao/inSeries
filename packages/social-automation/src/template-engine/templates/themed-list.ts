import { Badge, CTA, GenreChips, Platform, Poster, Progress, RankingItem, Rating, SeriesCard, Subtitle, Title, Watermark } from "../components";
import { feedLayout } from "../layouts";
import { escapeHtml, synopsisOrPlaceholder, truncate } from "../utils";
import { templateRegistry } from "../registry";
import { assertPayload, allSeries, ctaVisual, footer, header, layoutOptions, poster, storyTeaser } from "./_shared";
import type { RenderableDocument, SocialTemplate, TemplateBuildContext } from "../types";
import type { ContentPayload } from "../../content-engine/types";

const FEED_ITEMS = 4;
const MAX_ITEM_SLIDES = templateRegistry["themed-list"].maxSlides - 2; // reserva capa + CTA
const STORY_ITEMS = 3;

function themeLabel(payload: ContentPayload): string {
  const label = typeof payload.extra?.themeLabel === "string" ? payload.extra.themeLabel.trim() : "";
  return label || "Lista tematica";
}

/**
 * Lista tematica — o unico template com os tres formatos:
 *   feed: a lista inteira em um post;
 *   carrossel: capa + 1 serie por slide + slide de CTA;
 *   story: teaser.
 */
export const themedListTemplate: SocialTemplate = {
  key: "themed-list",

  buildFeed(ctx: TemplateBuildContext): RenderableDocument {
    const payload = assertPayload(ctx.payload, "themed-list");
    const series = allSeries(payload).slice(0, FEED_ITEMS);

    const body = `<div class="is-stack-sm">
      ${Title({ text: payload.title, size: "title", lines: 2, max: 60 })}
      ${
        series.length > 0
          ? // Compact rank rows (not full SeriesCards): 5 cards do not fit the 1080x1080 safe area.
            `<ol class="is-rank-list">${series
              .map((item, index) =>
                RankingItem({ position: index + 1, series: item, posterSrc: poster(ctx, item), metric: item.watchProviders?.[0] ?? null })
              )
              .join("")}</ol>`
          : Subtitle({ text: payload.hook, lines: 3 })
      }
    </div>`;

    const { html, viewport } = feedLayout({ header: header(themeLabel(payload), "bookmark"), body, footer: footer(payload) }, layoutOptions(ctx));
    return { html, viewport, slideKey: "feed" };
  },

  buildCarousel(ctx: TemplateBuildContext): RenderableDocument[] {
    const payload = assertPayload(ctx.payload, "themed-list");
    const series = allSeries(payload).slice(0, MAX_ITEM_SLIDES);
    const total = series.length + 2;
    const slides: RenderableDocument[] = [];

    const cover = feedLayout(
      {
        header: header(themeLabel(payload), "bookmark"),
        body: `<div class="is-stack-md" style="align-items:center;text-align:center">
          ${Badge({ text: themeLabel(payload), tone: "accent" })}
          ${Title({ text: payload.title, size: "display", lines: 3, max: 80 })}
          ${Subtitle({ text: payload.hook, lines: 3, max: 160 })}
        </div>`,
        footer: `<div class="is-stack-sm">${Progress({ value: 1, total, label: "Arraste para o lado" })}${Watermark({})}</div>`
      },
      layoutOptions(ctx, { background: "spotlight", showDecoration: true })
    );
    slides.push({ ...cover, slideKey: "cover" });

    series.forEach((item, index) => {
      const slide = feedLayout(
        {
          header: header(`${index + 1} de ${series.length}`, "play"),
          body: `<div class="is-split">
            <div class="is-split__media">${Poster({ title: item.title, src: poster(ctx, item), size: "lg" })}</div>
            <div class="is-split__content">
              ${Title({ text: item.title, size: "title", lines: 2, max: 52 })}
              <div class="is-card__meta">${Rating({ value: item.voteAverage, votes: item.voteCount })}<span class="is-dot"></span><span>${escapeHtml(
                String(item.firstAirYear ?? "—")
              )}</span></div>
              ${GenreChips({ genres: item.genres })}
              ${Subtitle({ text: synopsisOrPlaceholder(item, 170), lines: 4 })}
              ${Platform({ name: item.watchProviders?.[0] ?? null })}
            </div>
          </div>`,
          footer: `<div class="is-stack-sm">${Progress({ value: index + 2, total })}${Watermark({})}</div>`
        },
        layoutOptions(ctx)
      );
      slides.push({ ...slide, slideKey: `item-${index + 1}` });
    });

    // Slide final: ver comentario identico em similar-series.ts — headline/body/action distintos.
    const cta = ctaVisual(payload, "themed-list");
    const closing = feedLayout(
      {
        header: header("inSeries", "sparkles"),
        body: `<div class="is-stack-md" style="align-items:center;text-align:center">
          ${Title({ text: cta.headline, size: "display", lines: 2, max: 48 })}
          ${Subtitle({ text: cta.body, lines: 3, max: 120 })}
        </div>`,
        footer: `<div class="is-stack-sm">${CTA({ text: cta.action, variant: "bar" })}${Watermark({})}</div>`
      },
      layoutOptions(ctx, { background: "mesh", showDecoration: true })
    );
    slides.push({ ...closing, slideKey: "cta" });

    return slides;
  },

  buildStory(ctx: TemplateBuildContext): RenderableDocument {
    const payload = assertPayload(ctx.payload, "themed-list");
    const series = allSeries(payload).slice(0, STORY_ITEMS);
    return storyTeaser(ctx, {
      eyebrow: themeLabel(payload),
      icon: "bookmark",
      headline: truncate(payload.title, 80),
      support: payload.hook,
      content:
        series.length > 0
          ? `<div class="is-stack-sm">${series
              .map((item) => SeriesCard({ series: item, posterSrc: poster(ctx, item), layout: "horizontal" }))
              .join("")}</div>`
          : ""
    });
  }
};

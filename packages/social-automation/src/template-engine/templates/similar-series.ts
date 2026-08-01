import { Badge, CTA, GenreChips, Platform, Poster, Progress, Rating, SeriesCard, Subtitle, Title, Watermark } from "../components";
import { feedLayout } from "../layouts";
import { synopsisOrPlaceholder } from "../utils";
import { templateRegistry } from "../registry";
import { assertPayload, ctaVisual, header, layoutOptions, poster, storyTeaser } from "./_shared";
import type { RenderableDocument, SocialTemplate, TemplateBuildContext } from "../types";

const MAX_ITEM_SLIDES = templateRegistry["similar-series"].maxSlides - 2; // reserva capa + CTA

/**
 * "Para quem gostou de X" — carrossel:
 *   slide 1: capa (serie base)
 *   slides 2..N: 1 recomendacao por slide (payload.items)
 *   slide final: CTA
 * Mais o story teaser complementar.
 */
export const similarSeriesTemplate: SocialTemplate = {
  key: "similar-series",

  buildCarousel(ctx: TemplateBuildContext): RenderableDocument[] {
    const payload = assertPayload(ctx.payload, "similar-series");
    const seed = payload.sourceSeries;
    const items = payload.items.slice(0, MAX_ITEM_SLIDES);
    const total = items.length + 2;
    const slides: RenderableDocument[] = [];

    const cover = feedLayout(
      {
        header: header("Para quem gostou de", "heart"),
        body: `<div class="is-split">
          ${seed ? `<div class="is-split__media">${Poster({ title: seed.title, src: poster(ctx, seed), size: "lg" })}</div>` : ""}
          <div class="is-split__content">
            ${Title({ text: seed?.title ?? payload.title, size: "title", lines: 3, max: 60 })}
            ${Subtitle({ text: payload.hook, lines: 3, max: 160 })}
            ${Badge({ text: `${items.length} recomendacoes`, tone: "accent" })}
          </div>
        </div>`,
        footer: `<div class="is-stack-sm">${Progress({ value: 1, total, label: "Arraste para o lado" })}${Watermark({})}</div>`
      },
      layoutOptions(ctx, { background: "spotlight" })
    );
    slides.push({ ...cover, slideKey: "cover" });

    items.forEach((series, index) => {
      const slide = feedLayout(
        {
          header: header(`Recomendacao ${index + 1}`, "play"),
          body: `<div class="is-split">
            <div class="is-split__media">${Poster({ title: series.title, src: poster(ctx, series), size: "lg" })}</div>
            <div class="is-split__content">
              ${Title({ text: series.title, size: "title", lines: 2, max: 52 })}
              <div class="is-card__meta">${Rating({ value: series.voteAverage, votes: series.voteCount })}<span class="is-dot"></span><span>${series.firstAirYear ?? "—"}</span></div>
              ${GenreChips({ genres: series.genres })}
              ${Subtitle({ text: synopsisOrPlaceholder(series, 170), lines: 4 })}
              ${Platform({ name: series.watchProviders?.[0] ?? null })}
            </div>
          </div>`,
          footer: `<div class="is-stack-sm">${Progress({ value: index + 2, total })}${Watermark({})}</div>`
        },
        layoutOptions(ctx)
      );
      slides.push({ ...slide, slideKey: `item-${index + 1}` });
    });

    // Slide final: headline curta no titulo, CTA editorial no corpo, rotulo curto no botao.
    // Os tres textos sao derivados de cta-visual.ts justamente para nao repetirem o mesmo paragrafo.
    const cta = ctaVisual(payload, "similar-series");
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
    const payload = assertPayload(ctx.payload, "similar-series");
    const seed = payload.sourceSeries;
    const preview = payload.items.slice(0, 3);
    return storyTeaser(ctx, {
      eyebrow: "Para quem gostou de",
      icon: "heart",
      headline: seed ? `Gostou de ${seed.title}?` : payload.title,
      support: `${payload.items.length} series parecidas selecionadas pelo inSeries.`,
      content: preview.length > 0 ? `<div class="is-stack-sm">${preview.map((s) => SeriesCard({ series: s, posterSrc: poster(ctx, s), layout: "horizontal" })).join("")}</div>` : ""
    });
  }
};

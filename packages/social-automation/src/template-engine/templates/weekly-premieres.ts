import { Badge, Platform, Poster, Rating, SeriesCard, Subtitle, Title } from "../components";
import { feedLayout } from "../layouts";
import { escapeHtml, truncate } from "../utils";
import { assertPayload, allSeries, footer, header, layoutOptions, poster, storyTeaser } from "./_shared";
import type { RenderableDocument, SocialTemplate, TemplateBuildContext } from "../types";

/**
 * 3 posters in a single row is the largest grid that provably fits the 1080x1080 safe area with a
 * title, a subtitle and the mandatory CTA. Anything more overflowed the canvas, so the extra
 * premieres are named in the caption (built by the Content Engine), not crammed into the art.
 */
const FEED_ITEMS = 3;
const STORY_ITEMS = 3;

/** Estreias da semana — grade 3x2 no feed + story teaser com as 3 primeiras. */
export const weeklyPremieresTemplate: SocialTemplate = {
  key: "weekly-premieres",

  buildFeed(ctx: TemplateBuildContext): RenderableDocument {
    const payload = assertPayload(ctx.payload, "weekly-premieres");
    const series = allSeries(payload).slice(0, FEED_ITEMS);

    const body = `<div class="is-stack-sm">
      ${Title({ text: payload.title, size: "title", lines: 2, max: 60 })}
      ${Subtitle({ text: payload.hook, lines: 2, max: 130 })}
      ${
        series.length > 0
          ? `<div class="is-grid-3">${series
              .map(
                (item) => `<div class="is-stack-sm">
                  ${Poster({ title: item.title, src: poster(ctx, item), size: "md" })}
                  <span class="is-rank__title is-clamp is-clamp-2">${escapeHtml(truncate(item.title, 30))}</span>
                  ${Rating({ value: item.voteAverage, votes: item.voteCount })}
                  ${Platform({ name: item.watchProviders?.[0] ?? null })}
                </div>`
              )
              .join("")}</div>`
          : Subtitle({ text: "Nenhuma estreia confirmada para esta semana — acompanhe no inSeries.", lines: 2 })
      }
    </div>`;

    const { html, viewport } = feedLayout(
      { header: header("Estreias da semana", "calendar"), body, footer: footer(payload) },
      layoutOptions(ctx)
    );
    return { html, viewport, slideKey: "feed" };
  },

  buildStory(ctx: TemplateBuildContext): RenderableDocument {
    const payload = assertPayload(ctx.payload, "weekly-premieres");
    const series = allSeries(payload).slice(0, STORY_ITEMS);
    return storyTeaser(ctx, {
      eyebrow: "Estreias da semana",
      icon: "calendar",
      headline: truncate(payload.title, 70),
      support: payload.hook,
      content:
        series.length > 0
          ? `<div class="is-stack-sm">${Badge({ text: `${series.length} estreias`, tone: "primary", icon: "calendar" })}${series
              .map((item) => SeriesCard({ series: item, posterSrc: poster(ctx, item), layout: "horizontal" }))
              .join("")}</div>`
          : ""
    });
  }
};

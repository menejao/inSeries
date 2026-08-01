import { Badge, GenreChips, Platform, Poster, Rating, Subtitle, Title } from "../components";
import { feedLayout } from "../layouts";
import { synopsisOrPlaceholder } from "../utils";
import { assertPayload, footer, header, layoutOptions, poster, storyTeaser } from "./_shared";
import type { RenderableDocument, SocialTemplate, TemplateBuildContext } from "../types";

/** Serie do dia — feed 1080x1080 (poster + ficha) e story teaser. */
export const seriesOfTheDayTemplate: SocialTemplate = {
  key: "series-of-the-day",

  buildFeed(ctx: TemplateBuildContext): RenderableDocument {
    const payload = assertPayload(ctx.payload, "series-of-the-day");
    const series = payload.sourceSeries;

    const body = series
      ? `<div class="is-split">
          <div class="is-split__media">${Poster({ title: series.title, src: poster(ctx, series), size: "lg" })}</div>
          <div class="is-split__content">
            ${Badge({ text: "Serie do dia", tone: "primary", icon: "sparkles" })}
            ${Title({ text: series.title, size: "title", lines: 2, max: 60 })}
            <div class="is-card__meta">${Rating({ value: series.voteAverage, votes: series.voteCount })}<span class="is-dot"></span><span>${series.firstAirYear ?? "—"}</span></div>
            ${GenreChips({ genres: series.genres })}
            ${Subtitle({ text: synopsisOrPlaceholder(series, 190), lines: 4 })}
            ${Platform({ name: series.watchProviders?.[0] ?? null })}
          </div>
        </div>`
      : `<div class="is-stack-md">${Title({ text: payload.title, size: "display", lines: 3 })}${Subtitle({ text: payload.hook, lines: 3 })}</div>`;

    const { html, viewport } = feedLayout({ header: header(payload.hook, "sparkles"), body, footer: footer(payload) }, layoutOptions(ctx));
    return { html, viewport, slideKey: "feed" };
  },

  buildStory(ctx: TemplateBuildContext): RenderableDocument {
    const payload = assertPayload(ctx.payload, "series-of-the-day");
    const series = payload.sourceSeries;
    return storyTeaser(ctx, {
      eyebrow: "Serie do dia",
      icon: "sparkles",
      headline: series?.title ?? payload.title,
      support: series ? synopsisOrPlaceholder(series, 130) : payload.hook,
      content: series ? `<div class="is-row" style="gap:var(--is-space-sm)">${Poster({ title: series.title, src: poster(ctx, series), size: "md" })}<div class="is-stack-sm">${Rating({ value: series.voteAverage, votes: series.voteCount })}${GenreChips({ genres: series.genres, limit: 2 })}${Platform({ name: series.watchProviders?.[0] ?? null })}</div></div>` : ""
    });
  }
};

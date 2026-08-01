import { Badge, GenreChips, Poster, Rating, RankingItem, Subtitle, Title } from "../components";
import { feedLayout } from "../layouts";
import { truncate } from "../utils";
import { assertPayload, allSeries, footer, header, layoutOptions, poster, storyTeaser } from "./_shared";
import type { RenderableDocument, SocialTemplate, TemplateBuildContext } from "../types";

const FEED_ITEMS = 5;
const STORY_ITEMS = 3;

/** Em alta — lista curta das series com maior discoveryScore (feed) + story teaser. */
export const trendingTemplate: SocialTemplate = {
  key: "trending",

  buildFeed(ctx: TemplateBuildContext): RenderableDocument {
    const payload = assertPayload(ctx.payload, "trending");
    const series = allSeries(payload).slice(0, FEED_ITEMS);

    const body =
      series.length > 0
        ? `<div class="is-stack-sm">
            ${Title({ text: payload.title, size: "title", lines: 2, max: 62 })}
            ${Subtitle({ text: payload.hook, lines: 1, max: 96 })}
            <ol class="is-rank-list">
              ${series
                .map((item, index) =>
                  RankingItem({ position: index + 1, series: item, posterSrc: poster(ctx, item), metric: item.watchProviders?.[0] ?? null })
                )
                .join("")}
            </ol>
          </div>`
        : `<div class="is-stack-md">${Title({ text: payload.title, size: "display", lines: 3 })}${Subtitle({ text: payload.hook, lines: 3 })}</div>`;

    const { html, viewport } = feedLayout(
      { header: header("Em alta agora", "fire"), body, footer: footer(payload) },
      layoutOptions(ctx, { background: "spotlight" })
    );
    return { html, viewport, slideKey: "feed" };
  },

  buildStory(ctx: TemplateBuildContext): RenderableDocument {
    const payload = assertPayload(ctx.payload, "trending");
    const series = allSeries(payload).slice(0, STORY_ITEMS);
    return storyTeaser(ctx, {
      eyebrow: "Em alta agora",
      icon: "fire",
      headline: truncate(payload.title, 70),
      support: payload.hook,
      content:
        series.length > 0
          ? `<div class="is-stack-sm">
              ${Badge({ text: `Top ${series.length} da semana`, tone: "accent", icon: "fire" })}
              <div class="is-grid-3">
                ${series
                  .map(
                    (item) => `<div class="is-stack-sm">
                      ${Poster({ title: item.title, src: poster(ctx, item), size: "md" })}
                      <span class="is-rank__title is-clamp is-clamp-2">${truncate(item.title, 34)}</span>
                      ${Rating({ value: item.voteAverage, votes: item.voteCount })}
                      ${GenreChips({ genres: item.genres, limit: 1 })}
                    </div>`
                  )
                  .join("")}
              </div>
            </div>`
          : ""
    });
  }
};

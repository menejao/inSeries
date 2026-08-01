import { Badge, RankingItem, Subtitle, Title } from "../components";
import { feedLayout } from "../layouts";
import { escapeHtml, truncate } from "../utils";
import { assertPayload, allSeries, footer, header, layoutOptions, poster, storyTeaser } from "./_shared";
import type { RenderableDocument, SocialTemplate, TemplateBuildContext } from "../types";
import type { SeriesSummary } from "../../content-engine/types";

const FEED_ITEMS = 5;
const STORY_ITEMS = 3;

/** Human label for the `criterion` the Content Engine recorded in payload.extra. */
const CRITERION_LABELS: Record<string, string> = {
  "most-completed": "As mais concluidas pela comunidade",
  "most-rated": "As mais avaliadas pela comunidade"
};

function criterionOf(payload: { extra?: Record<string, unknown> }): string {
  const raw = typeof payload.extra?.criterion === "string" ? payload.extra.criterion : "";
  return CRITERION_LABELS[raw] ?? "Ranking da comunidade inSeries";
}

/**
 * Metric shown next to each entry. Read only from payload.extra.ranking (produced by
 * content-engine/formats/ranking.ts); never recomputed here.
 */
function metricFor(payload: { extra?: Record<string, unknown> }, series: SeriesSummary): string | null {
  const ranking = Array.isArray(payload.extra?.ranking) ? (payload.extra?.ranking as Array<Record<string, unknown>>) : [];
  const entry = ranking.find((row) => row.seriesId === series.id);
  if (!entry) return null;
  if (typeof entry.completedCount === "number") return `${entry.completedCount} concluiram`;
  if (typeof entry.reviewCount === "number") return `${entry.reviewCount} avaliacoes`;
  return null;
}

/** Ranking — Top 5 no feed, Top 3 no story, com o criterio sempre explicito na arte. */
export const rankingTemplate: SocialTemplate = {
  key: "ranking",

  buildFeed(ctx: TemplateBuildContext): RenderableDocument {
    const payload = assertPayload(ctx.payload, "ranking");
    const series = allSeries(payload).slice(0, FEED_ITEMS);

    const body = `<div class="is-stack-sm">
      ${Title({ text: payload.title, size: "title", lines: 2, max: 60 })}
      <p class="is-subtitle is-subtitle--accent">${escapeHtml(criterionOf(payload))}</p>
      ${
        series.length > 0
          ? `<ol class="is-rank-list">${series
              .map((item, index) =>
                RankingItem({ position: index + 1, series: item, posterSrc: poster(ctx, item), metric: metricFor(payload, item) })
              )
              .join("")}</ol>`
          : Subtitle({ text: payload.hook, lines: 3 })
      }
    </div>`;

    const { html, viewport } = feedLayout({ header: header("Ranking", "poll"), body, footer: footer(payload) }, layoutOptions(ctx));
    return { html, viewport, slideKey: "feed" };
  },

  buildStory(ctx: TemplateBuildContext): RenderableDocument {
    const payload = assertPayload(ctx.payload, "ranking");
    const series = allSeries(payload).slice(0, STORY_ITEMS);
    return storyTeaser(ctx, {
      eyebrow: "Ranking",
      icon: "poll",
      headline: truncate(payload.title, 70),
      support: criterionOf(payload),
      content:
        series.length > 0
          ? `<div class="is-stack-sm">
              ${Badge({ text: `Top ${series.length}`, tone: "primary" })}
              <ol class="is-rank-list">${series
                .map((item, index) =>
                  RankingItem({ position: index + 1, series: item, posterSrc: poster(ctx, item), metric: metricFor(payload, item) })
                )
                .join("")}</ol>
            </div>`
          : ""
    });
  }
};

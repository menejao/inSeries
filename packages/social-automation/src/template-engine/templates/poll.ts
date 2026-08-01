import { Badge, PollOption, Subtitle, Title } from "../components";
import { feedLayout } from "../layouts";
import { truncate } from "../utils";
import { assertPayload, allSeries, footer, header, layoutOptions, storyTeaser } from "./_shared";
import type { RenderableDocument, SocialTemplate, TemplateBuildContext } from "../types";
import type { ContentPayload } from "../../content-engine/types";

const MAX_OPTIONS = 4;

/**
 * Options come from payload.extra.options (content-engine/formats/poll.ts). If that is missing we
 * degrade to the series titles in the payload rather than rendering an empty question card.
 */
function optionLabels(payload: ContentPayload): string[] {
  const raw = Array.isArray(payload.extra?.options) ? (payload.extra?.options as Array<Record<string, unknown>>) : [];
  const fromExtra = raw.map((option) => (typeof option.label === "string" ? option.label : "")).filter(Boolean);
  if (fromExtra.length > 0) return fromExtra.slice(0, MAX_OPTIONS);
  return allSeries(payload)
    .map((series) => series.title)
    .slice(0, MAX_OPTIONS);
}

function questionOf(payload: ContentPayload): string {
  const question = typeof payload.extra?.question === "string" ? payload.extra.question.trim() : "";
  return question || payload.title;
}

/** Enquete — layout proprio de pergunta + opcoes A/B/C, para feed e story. */
export const pollTemplate: SocialTemplate = {
  key: "poll",

  buildFeed(ctx: TemplateBuildContext): RenderableDocument {
    const payload = assertPayload(ctx.payload, "poll");
    const options = optionLabels(payload);

    const body = `<div class="is-stack-md">
      ${Badge({ text: "Enquete", tone: "accent", icon: "poll" })}
      ${Title({ text: questionOf(payload), size: "title", lines: 3, max: 120 })}
      ${
        options.length > 0
          ? `<ul class="is-poll-list">${options.map((label, index) => PollOption({ label, index })).join("")}</ul>`
          : Subtitle({ text: payload.hook, lines: 3 })
      }
    </div>`;

    const { html, viewport } = feedLayout(
      { header: header("Responde ai", "poll"), body, footer: footer(payload) },
      layoutOptions(ctx, { background: "mesh" })
    );
    return { html, viewport, slideKey: "feed" };
  },

  buildStory(ctx: TemplateBuildContext): RenderableDocument {
    const payload = assertPayload(ctx.payload, "poll");
    const options = optionLabels(payload);
    return storyTeaser(ctx, {
      eyebrow: "Enquete",
      icon: "poll",
      headline: truncate(questionOf(payload), 90),
      support: payload.hook,
      content:
        options.length > 0 ? `<ul class="is-poll-list">${options.map((label, index) => PollOption({ label, index })).join("")}</ul>` : ""
    });
  }
};

import { describe, expect, it } from "vitest";
import { buildDocuments } from "../preview";
import { resolveCtaVisual } from "../cta-visual";
import { TEMPLATE_KEYS, templateRegistry } from "../registry";
import { payloadFor } from "../sandbox/fixtures";
import type { ContentPayload } from "../../content-engine/types";

/**
 * INSERIES-SOCIAL-TEMPLATE-ENGINE-04-FINALIZATION — problema 2, ponta a ponta.
 * Garante que o HTML realmente gerado (slide final de carrossel, story e feed) nao carrega o CTA
 * editorial completo em duas areas visuais.
 */

const LONG_CTA =
  "Se voce curtiu essas recomendacoes, salve este post agora mesmo e acompanhe o inSeries todos os dias para receber muitas outras sugestoes.";

function withCta(payload: ContentPayload, text: string): ContentPayload {
  return { ...payload, cta: { ...payload.cta, text } };
}

/** Quantas vezes o CTA integral (escapado como o template escreveria) aparece no documento. */
function occurrences(html: string, needle: string): number {
  return html.split(needle).length - 1;
}

describe("slide final de CTA", () => {
  for (const key of TEMPLATE_KEYS) {
    const entry = templateRegistry[key];
    if (!entry.supports.includes("carousel")) continue;

    it(`${key}: o slide final nao repete o CTA integral`, () => {
      const payload = withCta(payloadFor(key), LONG_CTA);
      const docs = buildDocuments(payload, "carousel");
      const closing = docs[docs.length - 1];
      expect(closing.slideKey).toBe("cta");
      expect(occurrences(closing.html, LONG_CTA)).toBe(0); // truncado, nunca integral
      const visual = resolveCtaVisual(payload, key);
      expect(closing.html).toContain(visual.headline);
      expect(closing.html).toContain(visual.action);
      expect(visual.headline).not.toBe(visual.action);
    });
  }

  for (const key of TEMPLATE_KEYS) {
    it(`${key}: o story usa headline/body/action distintos`, () => {
      const payload = withCta(payloadFor(key), LONG_CTA);
      const [story] = buildDocuments(payload, "story");
      const visual = resolveCtaVisual(payload, key);
      expect(story.html).toContain(visual.action);
      expect(occurrences(story.html, LONG_CTA)).toBe(0);
    });
  }

  for (const key of TEMPLATE_KEYS) {
    const entry = templateRegistry[key];
    if (!entry.supports.includes("feed")) continue;

    it(`${key}: o feed leva so a chamada curta, nunca o paragrafo do CTA`, () => {
      const payload = withCta(payloadFor(key), LONG_CTA);
      const [feed] = buildDocuments(payload, "feed");
      const visual = resolveCtaVisual(payload, key);
      expect(feed.html).toContain(visual.action);
      expect(occurrences(feed.html, LONG_CTA)).toBe(0);
      // O corpo editorial completo fica so na legenda, nunca na arte do feed.
      expect(feed.html).not.toContain(visual.body);
    });
  }

  it("payload sem CTA falha alto em vez de renderizar area vazia", () => {
    const payload = withCta(payloadFor("themed-list"), "   ");
    expect(() => buildDocuments(payload, "story")).toThrow(/CTA visivel/);
  });
});

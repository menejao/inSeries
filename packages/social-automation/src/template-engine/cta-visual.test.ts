import { describe, expect, it } from "vitest";
import { CTA_ACTIONS, CTA_BODY_MAX, CTA_HEADLINE_MAX, deriveAction, resolveCtaVisual } from "./cta-visual";
import { TemplateEngineError } from "./types";
import type { ContentPayload } from "../content-engine/types";

/**
 * INSERIES-SOCIAL-TEMPLATE-ENGINE-04-FINALIZATION — problema 2.
 * A regra central sob teste: o texto integral do CTA original nunca aparece em duas areas visuais.
 */

function payloadWith(ctaText: string, extra: Partial<ContentPayload> = {}): ContentPayload {
  return {
    type: "similar-series",
    title: "Titulo",
    hook: "Hook",
    sourceSeries: null,
    items: [],
    caption: "",
    cta: { id: "cta-1", text: ctaText },
    hashtags: [],
    templateKey: "similar-series",
    requiresApproval: false,
    format: "carousel",
    hookId: "hook-1",
    ...extra
  } as ContentPayload;
}

/** Nenhuma das tres areas pode ser igual a outra, nem conter o CTA original inteiro duas vezes. */
function expectNoDuplication(visual: { headline: string; body: string; action: string }, original: string) {
  expect(visual.headline).not.toBe(visual.action);
  expect(visual.headline).not.toBe(visual.body);
  expect(visual.body).not.toBe(visual.action);
  const areasWithFullCta = [visual.headline, visual.body, visual.action].filter((area) => area.trim() === original.trim());
  expect(areasWithFullCta.length).toBeLessThanOrEqual(1);
}

describe("resolveCtaVisual", () => {
  it("CTA curto: headline generica, body com o CTA, action curta e distinta", () => {
    const original = "Link na bio!";
    const visual = resolveCtaVisual(payloadWith(original));
    expect(visual.headline.length).toBeLessThanOrEqual(CTA_HEADLINE_MAX);
    expect(visual.body).toBe(original);
    expect(visual.action).toBe(CTA_ACTIONS.bioAlt);
    expectNoDuplication(visual, original);
  });

  it("CTA longo (~150 chars): headline curta, body truncado a 120, nenhuma repeticao", () => {
    const original =
      "Se voce curtiu essas recomendacoes, salve este post agora mesmo e acompanhe o inSeries todos os dias para receber muitas outras sugestoes de series incriveis.";
    expect(original.length).toBeGreaterThan(140);
    const visual = resolveCtaVisual(payloadWith(original));
    expect(visual.headline.length).toBeLessThanOrEqual(CTA_HEADLINE_MAX);
    expect(visual.body.length).toBeLessThanOrEqual(CTA_BODY_MAX);
    expect(visual.body).not.toBe(original);
    expectNoDuplication(visual, original);
  });

  it("nao corta palavra no meio na headline", () => {
    const original = "Descubra agora. Acompanhe o inSeries diariamente para novas recomendacoes personalizadas de series.";
    const visual = resolveCtaVisual(payloadWith(original));
    expect(visual.headline).toBe("Descubra agora");
    expect(visual.body.startsWith("Acompanhe")).toBe(true);
    expectNoDuplication(visual, original);
  });

  it("preserva acentos e cedilha", () => {
    const original = "Não perca nenhuma estreia. Ative as notificações e acompanhe o inSeries todos os dias, é grátis.";
    const visual = resolveCtaVisual(payloadWith(original));
    expect(visual.headline).toBe("Não perca nenhuma estreia");
    expect(visual.body).toContain("notificações");
    expectNoDuplication(visual, original);
  });

  it("CTA exatamente no limite da headline continua inteiro", () => {
    const first = "a".repeat(CTA_HEADLINE_MAX);
    const original = `${first}. resto do texto editorial do cta.`;
    const visual = resolveCtaVisual(payloadWith(original));
    expect(visual.headline).toBe(first);
    expect(visual.headline.length).toBe(CTA_HEADLINE_MAX);
  });

  it("primeira frase acima do limite cai na headline generica", () => {
    const original = `${"palavra ".repeat(12)}. e continua depois disso tudo.`;
    const visual = resolveCtaVisual(payloadWith(original));
    expect(visual.headline.length).toBeLessThanOrEqual(CTA_HEADLINE_MAX);
    expect(visual.headline).toBe("Gostou dessas recomendacoes?");
    expectNoDuplication(visual, original);
  });

  it("headline generica varia por templateKey e nunca excede o limite", () => {
    const keys = [
      "series-of-the-day",
      "similar-series",
      "trending",
      "weekly-premieres",
      "ranking",
      "poll",
      "themed-list",
      "inseries-feature"
    ];
    for (const key of keys) {
      const visual = resolveCtaVisual(payloadWith("Confira tudo no app.", { templateKey: key }));
      expect(visual.headline.length).toBeLessThanOrEqual(CTA_HEADLINE_MAX);
      expect(visual.headline).not.toBe(visual.action);
    }
  });

  it("ausencia de CTA lanca erro claro em vez de renderizar vazio", () => {
    expect(() => resolveCtaVisual(payloadWith(""))).toThrow(TemplateEngineError);
    expect(() => resolveCtaVisual(payloadWith("   "))).toThrow(/CTA visivel/);
    expect(() => resolveCtaVisual(null)).toThrow(TemplateEngineError);
  });

  it("usa campos estruturados quando existirem", () => {
    const visual = resolveCtaVisual(
      payloadWith("texto editorial completo", {
        extra: { ctaHeadline: "Headline propria", ctaBody: "Body proprio", ctaAction: "Ir agora" }
      })
    );
    expect(visual).toEqual({ headline: "Headline propria", body: "Body proprio", action: "Ir agora" });
  });

  it("e deterministico: mesma entrada, mesma saida", () => {
    const original = "Salve esse post e acompanhe o inSeries todos os dias.";
    expect(resolveCtaVisual(payloadWith(original))).toEqual(resolveCtaVisual(payloadWith(original)));
  });
});

describe("deriveAction", () => {
  it("default e Link na bio", () => {
    expect(deriveAction("Salve esse post e volte amanha")).toBe(CTA_ACTIONS.bio);
  });
  it("evita ecoar 'link na bio' quando o proprio CTA ja diz isso", () => {
    expect(deriveAction("Acesse o link na bio para ver a lista completa")).toBe(CTA_ACTIONS.bioAlt);
  });
  it("menciona bio de outra forma", () => {
    expect(deriveAction("Tudo isso esta na nossa bio")).toBe(CTA_ACTIONS.bio);
  });
  it("CTA que cita o inSeries", () => {
    expect(deriveAction("Continue descobrindo no inSeries")).toBe(CTA_ACTIONS.continueInseries);
  });
  it("CTA que cita o app", () => {
    expect(deriveAction("Baixe o app e descubra")).toBe(CTA_ACTIONS.knowInseries);
  });
});

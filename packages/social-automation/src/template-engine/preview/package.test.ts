import { describe, expect, it } from "vitest";
import { buildDocuments, generatePublicationPackage } from "./index";
import { getTemplateEntry } from "../registry";
import { payloadFor, sandboxPayloads, series } from "../sandbox/fixtures";
import { TemplateEngineError } from "../types";
import type { ContentPayload } from "../../content-engine/types";

/**
 * INSERIES-SOCIAL-TEMPLATE-ENGINE-04 — montagem do pacote de publicacao.
 *
 * Roda em `dryRun`: valida a COMPOSICAO (documentos, formatos, legenda, CTA, alt-texts) sem
 * levantar o Chromium — a rasterizacao real e verificada pelo script de sandbox.
 */
describe("generatePublicationPackage", () => {
  it("produz story para todos os templates, mesmo os de feed unico", async () => {
    for (const payload of sandboxPayloads) {
      const pack = await generatePublicationPackage(payload, { dryRun: true });
      expect(pack.story, payload.templateKey).toBeTruthy();
      expect(pack.story.width).toBe(1080);
      expect(pack.story.height).toBe(1920);
    }
  });

  it("respeita os formatos declarados no registry", async () => {
    for (const payload of sandboxPayloads) {
      const entry = getTemplateEntry(payload.templateKey)!;
      const pack = await generatePublicationPackage(payload, { dryRun: true });

      expect(Boolean(pack.feed)).toBe(entry.supports.includes("feed"));
      expect(pack.carousel.length > 0).toBe(entry.supports.includes("carousel"));
      if (entry.supports.includes("carousel")) {
        expect(pack.carousel.length).toBeLessThanOrEqual(entry.maxSlides);
      }
    }
  });

  it("copia legenda, CTA e hashtags do payload sem reescrever nada", async () => {
    const payload = payloadFor("series-of-the-day");
    const pack = await generatePublicationPackage(payload, { dryRun: true });

    expect(pack.caption).toBe(payload.caption);
    expect(pack.ctaText).toBe(payload.cta.text);
    expect(pack.hashtags).toEqual(payload.hashtags);
    expect(pack.templateKey).toBe("series-of-the-day");
  });

  it("gera um alt-text por imagem", async () => {
    const payload = payloadFor("themed-list");
    const pack = await generatePublicationPackage(payload, { dryRun: true });
    const imageCount = (pack.feed ? 1 : 0) + pack.carousel.length + 1;

    expect(pack.altTexts).toHaveLength(imageCount);
    expect(new Set(pack.altTexts).size).toBe(imageCount); // nenhum alt duplicado
  });

  it("carrossel comeca em capa e termina em CTA", () => {
    const docs = buildDocuments(payloadFor("similar-series"), "carousel");
    expect(docs[0].slideKey).toBe("cover");
    expect(docs[docs.length - 1].slideKey).toBe("cta");
    expect(docs.length).toBeGreaterThanOrEqual(3);
  });

  it("todo formato entrega um CTA renderizado (feed e story no proprio post, carrossel no slide final)", () => {
    // `is-cta` aparece no CSS inline de qualquer documento; o que importa e o ELEMENTO renderizado.
    const ctaElement = /<div class="is-cta is-cta--/;

    for (const payload of sandboxPayloads) {
      const entry = getTemplateEntry(payload.templateKey)!;

      for (const format of entry.supports) {
        const docs = buildDocuments(payload, format);
        const withCta = docs.filter((doc) => ctaElement.test(doc.html));

        if (format === "carousel") {
          // O CTA e o slide de fechamento do carrossel.
          expect(withCta.length, `${payload.templateKey}/${format}`).toBeGreaterThan(0);
          expect(docs[docs.length - 1].slideKey).toBe("cta");
        } else {
          expect(withCta.length, `${payload.templateKey}/${format}`).toBe(docs.length);
        }
      }
    }
  });

  it("nenhum documento faz requisicao de rede (sem img remota, sem @import, sem <link>)", () => {
    for (const payload of sandboxPayloads) {
      const entry = getTemplateEntry(payload.templateKey)!;
      for (const format of entry.supports) {
        for (const doc of buildDocuments(payload, format)) {
          expect(doc.html).not.toMatch(/src="https?:\/\//);
          expect(doc.html).not.toMatch(/@import|<link/);
          expect(doc.html).not.toMatch(/url\(["']?https?:/);
        }
      }
    }
  });

  it("avisa (mas nao quebra) quando um tema sazonal ainda nao existe", async () => {
    const pack = await generatePublicationPackage(payloadFor("poll"), { dryRun: true, themeKey: "halloween" });
    expect(pack.themeKey).toBe("default");
    expect(pack.warnings.join(" ")).toContain("halloween");
  });
});

describe("payload invalido", () => {
  const base = payloadFor("series-of-the-day");

  it("rejeita payload ausente", async () => {
    await expect(generatePublicationPackage(null as unknown as ContentPayload)).rejects.toBeInstanceOf(TemplateEngineError);
    await expect(generatePublicationPackage(undefined as unknown as ContentPayload)).rejects.toBeInstanceOf(TemplateEngineError);
  });

  it("rejeita templateKey desconhecido", async () => {
    const payload = { ...base, templateKey: "template-que-nao-existe" };
    await expect(generatePublicationPackage(payload as ContentPayload)).rejects.toThrow(/nao existe no registry/);
  });

  it("rejeita payload sem title", () => {
    const payload = { ...base, title: "" } as ContentPayload;
    expect(() => buildDocuments(payload, "feed")).toThrow(/title/);
  });

  it("rejeita payload sem CTA — todo formato exige CTA visivel", () => {
    const payload = { ...base, cta: undefined } as unknown as ContentPayload;
    expect(() => buildDocuments(payload, "feed")).toThrow(/cta/i);
  });

  it("rejeita items que nao sao array", () => {
    const payload = { ...base, items: "nao-e-array" } as unknown as ContentPayload;
    expect(() => buildDocuments(payload, "feed")).toThrow(/items/);
  });

  it("rejeita formato nao suportado pelo template", () => {
    expect(() => buildDocuments(payloadFor("series-of-the-day"), "carousel")).toThrow(/nao suporta o formato/);
  });

  it("aceita payload minimo, sem serie nenhuma, sem quebrar", async () => {
    const payload: ContentPayload = { ...base, sourceSeries: null, items: [] };
    const pack = await generatePublicationPackage(payload, { dryRun: true });
    expect(pack.feed).toBeTruthy();
    expect(pack.story).toBeTruthy();
  });

  it("aceita series sem nenhum campo opcional preenchido", async () => {
    const payload: ContentPayload = {
      ...payloadFor("trending"),
      sourceSeries: series({ id: "vazia", title: "Serie Vazia" }),
      items: [series({ id: "vazia-2", title: "Outra Vazia" })]
    };

    const pack = await generatePublicationPackage(payload, { dryRun: true });
    expect(pack.feed).toBeTruthy();
    expect(pack.warnings).not.toContain("erro");
  });
});

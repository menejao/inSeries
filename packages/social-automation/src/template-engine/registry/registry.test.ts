import { describe, expect, it } from "vitest";
import { TEMPLATE_KEYS, getTemplateEntry, isTemplateKey, listTemplates, supportsFormat, templateRegistry } from "./index";
import { templates } from "../templates";
import { availableFormats } from "../preview";
import { listThemes, resolveTheme } from "../themes";

/** INSERIES-SOCIAL-TEMPLATE-ENGINE-04 — registry e o contrato registry <-> templates. */
describe("template registry", () => {
  it("declara os 8 templateKeys do Content Engine", () => {
    expect(TEMPLATE_KEYS.sort()).toEqual(
      [
        "inseries-feature",
        "poll",
        "ranking",
        "series-of-the-day",
        "similar-series",
        "themed-list",
        "trending",
        "weekly-premieres"
      ].sort()
    );
  });

  it("mantem os metadados obrigatorios preenchidos em toda entrada", () => {
    for (const entry of listTemplates()) {
      expect(entry.id).toBeTruthy();
      expect(entry.nome.length).toBeGreaterThan(2);
      expect(entry.descricao.length).toBeGreaterThan(10);
      expect(typeof entry.ativo).toBe("boolean");
      expect(entry.supports.length).toBeGreaterThan(0);
      expect(entry.maxSlides).toBeGreaterThanOrEqual(1);
      expect(entry.categoria).toBeTruthy();
      expect(entry.orientacao).toBeTruthy();
    }
  });

  it("garante que a chave do registry e a do proprio objeto (sem desalinhamento)", () => {
    for (const [key, entry] of Object.entries(templateRegistry)) {
      expect(entry.id).toBe(key);
    }
  });

  it("tem um template implementado para cada entrada do registry", () => {
    for (const entry of listTemplates()) {
      const template = templates[entry.id];
      expect(template, `template ${entry.id}`).toBeDefined();
      expect(template.key).toBe(entry.id);
      // story e obrigatorio em todo template
      expect(typeof template.buildStory).toBe("function");
      if (entry.supports.includes("feed")) expect(typeof template.buildFeed).toBe("function");
      if (entry.supports.includes("carousel")) expect(typeof template.buildCarousel).toBe("function");
    }
  });

  it("declara story em todos os templates (teaser sempre existe)", () => {
    for (const entry of listTemplates()) {
      expect(entry.supports).toContain("story");
    }
  });

  it("reserva capa + CTA no maxSlides dos templates de carrossel", () => {
    for (const entry of listTemplates()) {
      if (entry.supports.includes("carousel")) expect(entry.maxSlides).toBeGreaterThanOrEqual(3);
    }
  });

  it("isTemplateKey/getTemplateEntry rejeitam chaves desconhecidas", () => {
    expect(isTemplateKey("series-of-the-day")).toBe(true);
    expect(isTemplateKey("nao-existe")).toBe(false);
    expect(getTemplateEntry("nao-existe")).toBeNull();
    expect(supportsFormat("nao-existe", "feed")).toBe(false);
  });

  it("supportsFormat respeita o campo ativo", () => {
    expect(supportsFormat("series-of-the-day", "feed")).toBe(true);
    expect(supportsFormat("series-of-the-day", "carousel")).toBe(false);
  });

  it("availableFormats sempre termina em story", () => {
    for (const key of TEMPLATE_KEYS) {
      const formats = availableFormats(key);
      expect(formats[formats.length - 1]).toBe("story");
    }
    expect(availableFormats("nao-existe")).toEqual([]);
  });
});

describe("theme registry", () => {
  it("resolve temas implementados e faz fallback nos declarados", () => {
    expect(resolveTheme("light").fallbackApplied).toBe(false);
    expect(resolveTheme("light").theme.key).toBe("light");

    const halloween = resolveTheme("halloween");
    expect(halloween.fallbackApplied).toBe(true);
    expect(halloween.theme.key).toBe("default");

    const unknown = resolveTheme("nao-existe");
    expect(unknown.fallbackApplied).toBe(true);
    expect(unknown.theme.key).toBe("default");
  });

  it("nunca lanca para null/undefined", () => {
    expect(() => resolveTheme(null)).not.toThrow();
    expect(() => resolveTheme(undefined)).not.toThrow();
    expect(listThemes().length).toBeGreaterThanOrEqual(3);
  });
});

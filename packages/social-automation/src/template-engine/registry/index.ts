/**
 * Template Registry — declarative metadata for every template. The renderers read `supports` from
 * here to decide which formats a payload produces; templates never decide that themselves.
 *
 * The keys mirror the Content Engine's `templateKey` values 1:1 (see content-engine/formats/) —
 * a payload maps to a template purely by that key, no heuristics.
 */
import type { OutputFormat, TemplateKey, TemplateRegistryEntry } from "../types";

export const templateRegistry: Record<TemplateKey, TemplateRegistryEntry> = {
  "series-of-the-day": {
    id: "series-of-the-day",
    nome: "Serie do dia",
    descricao: "Destaque unico com poster, nota, generos e sinopse curta.",
    ativo: true,
    supports: ["feed", "story"],
    maxSlides: 1,
    orientacao: "square+vertical",
    categoria: "descoberta"
  },
  "similar-series": {
    id: "similar-series",
    nome: "Para quem gostou de",
    descricao: "Carrossel: capa com a serie base + 1 recomendacao por slide + slide de CTA.",
    ativo: true,
    supports: ["carousel", "story"],
    maxSlides: 10,
    orientacao: "square+vertical",
    categoria: "recomendacao"
  },
  trending: {
    id: "trending",
    nome: "Em alta",
    descricao: "Feed em formato de ranking curto das series com maior discoveryScore.",
    ativo: true,
    supports: ["feed", "story"],
    maxSlides: 1,
    orientacao: "square+vertical",
    categoria: "descoberta"
  },
  ranking: {
    id: "ranking",
    nome: "Ranking",
    descricao: "Top 5 no feed e top 3 no story, com o criterio explicito (mais concluidas / mais avaliadas).",
    ativo: true,
    supports: ["feed", "story"],
    maxSlides: 1,
    orientacao: "square+vertical",
    categoria: "curadoria"
  },
  "weekly-premieres": {
    id: "weekly-premieres",
    nome: "Estreias da semana",
    descricao: "Grade das series com episodios da semana + story teaser.",
    ativo: true,
    supports: ["feed", "story"],
    maxSlides: 1,
    orientacao: "square+vertical",
    categoria: "curadoria"
  },
  poll: {
    id: "poll",
    nome: "Enquete",
    descricao: "Layout proprio de pergunta + opcoes (A/B/C) para feed e story.",
    ativo: true,
    supports: ["feed", "story"],
    maxSlides: 1,
    orientacao: "square+vertical",
    categoria: "engajamento"
  },
  "themed-list": {
    id: "themed-list",
    nome: "Lista tematica",
    descricao: "Feed com a lista, carrossel com uma serie por slide e story teaser.",
    ativo: true,
    supports: ["feed", "carousel", "story"],
    maxSlides: 10,
    orientacao: "square+vertical",
    categoria: "curadoria"
  },
  "inseries-feature": {
    id: "inseries-feature",
    nome: "Recurso do inSeries",
    descricao: "Post de produto: um recurso real do app, sem series envolvidas.",
    ativo: true,
    supports: ["feed", "story"],
    maxSlides: 1,
    orientacao: "square+vertical",
    categoria: "produto"
  }
};

export const TEMPLATE_KEYS = Object.keys(templateRegistry) as TemplateKey[];

export function isTemplateKey(value: string): value is TemplateKey {
  return Object.prototype.hasOwnProperty.call(templateRegistry, value);
}

export function getTemplateEntry(key: string): TemplateRegistryEntry | null {
  return isTemplateKey(key) ? templateRegistry[key] : null;
}

export function listTemplates(): TemplateRegistryEntry[] {
  return Object.values(templateRegistry);
}

export function supportsFormat(key: string, format: OutputFormat): boolean {
  const entry = getTemplateEntry(key);
  return Boolean(entry?.ativo && entry.supports.includes(format));
}

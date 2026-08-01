/** Shared types of the Template Engine (kept out of index.ts to avoid import cycles). */
import type { Viewport } from "./design-system";
import type { ContentPayload } from "../content-engine/types";

export type OutputFormat = "feed" | "carousel" | "story";

/** An HTML document + the viewport it must be screenshotted at. The renderer consumes only this. */
export interface RenderableDocument {
  html: string;
  viewport: Viewport;
  /** Used for alt-text/filenames; e.g. "cover", "item-1", "cta". */
  slideKey?: string;
}

export interface TemplateBuildContext {
  payload: ContentPayload;
  themeKey?: string | null;
  /**
   * Off by default. When false, posters render as deterministic gradient placeholders and the
   * document makes zero network requests — the guarantee the ticket requires.
   */
  allowRemoteImages: boolean;
}

/** Every template file in templates/ exports one of these. */
export interface SocialTemplate {
  key: TemplateKey;
  buildFeed?(ctx: TemplateBuildContext): RenderableDocument;
  buildCarousel?(ctx: TemplateBuildContext): RenderableDocument[];
  /** Mandatory: every template must be able to produce the complementary story teaser. */
  buildStory(ctx: TemplateBuildContext): RenderableDocument;
}

export type TemplateKey =
  | "series-of-the-day"
  | "similar-series"
  | "trending"
  | "weekly-premieres"
  | "ranking"
  | "poll"
  | "themed-list"
  | "inseries-feature";

export type TemplateCategory = "descoberta" | "recomendacao" | "curadoria" | "engajamento" | "produto";

export interface TemplateRegistryEntry {
  id: TemplateKey;
  nome: string;
  descricao: string;
  ativo: boolean;
  supports: OutputFormat[];
  maxSlides: number;
  orientacao: "square" | "portrait" | "vertical" | "square+vertical";
  categoria: TemplateCategory;
}

export interface GeneratedImage {
  format: OutputFormat;
  buffer: Buffer;
  width: number;
  height: number;
  altText: string;
  fileName: string;
  slideIndex?: number;
}

export interface PublicationPackage {
  templateKey: TemplateKey;
  themeKey: string;
  feed: GeneratedImage | null;
  carousel: GeneratedImage[];
  story: GeneratedImage;
  caption: string;
  ctaText: string;
  hashtags: string[];
  altTexts: string[];
  /** Passthrough placeholder — the real scheduler lives in scheduler/, nothing is reimplemented here. */
  recommendedTime: string | null;
  warnings: string[];
}

export class TemplateEngineError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TemplateEngineError";
  }
}

export type { ContentPayload };

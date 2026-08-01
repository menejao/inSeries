/**
 * Publication package builder + the admin preview entry points.
 *
 * `generatePublicationPackage()` is the one public door of the Template Engine: give it a
 * ContentPayload already produced by the Content Engine and it returns every image the publisher
 * would need (feed and/or carousel, ALWAYS a story teaser), plus the caption/CTA/hashtags/alt-texts
 * copied straight from the payload — nothing is re-generated, re-worded or invented here.
 *
 * Rules encoded here (from the ticket):
 *  - a Story Teaser is produced whenever there is a feed or a carousel, and stories are mandatory
 *    for every template, so `package.story` is never null;
 *  - the CTA is mandatory on every format — the templates always render it and `assertPayload`
 *    rejects a payload without `cta.text`;
 *  - the registry decides which formats a template supports; templates never decide it.
 */
import { requireTemplate } from "../templates";
import { getTemplateEntry } from "../registry";
import { resolveTheme } from "../themes";
import { render, renderCached, type PreviewCacheKeyInput, type RenderOptions } from "../renderer";
import { buildAltText } from "../utils";
import {
  TemplateEngineError,
  type GeneratedImage,
  type OutputFormat,
  type PublicationPackage,
  type RenderableDocument,
  type TemplateBuildContext
} from "../types";
import type { ContentPayload } from "../../content-engine/types";

export interface GeneratePackageOptions {
  themeKey?: string | null;
  /** Off by default — remote posters would make renders network-dependent. */
  allowRemoteImages?: boolean;
  render?: RenderOptions;
  /** Skip the (expensive) rasterisation and return only the HTML documents. Used by tests. */
  dryRun?: boolean;
}

function slug(value: string): string {
  return value
    .normalize("NFD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "post";
}

function buildContext(payload: ContentPayload, options: GeneratePackageOptions): TemplateBuildContext {
  return {
    payload,
    themeKey: options.themeKey ?? null,
    allowRemoteImages: options.allowRemoteImages === true
  };
}

/**
 * Builds the HTML documents for one format without rasterising them. Exposed because the admin
 * preview route and the sandbox both need "documents first, pixels later".
 */
export function buildDocuments(payload: ContentPayload, format: OutputFormat, options: GeneratePackageOptions = {}): RenderableDocument[] {
  if (!payload || typeof payload !== "object") {
    throw new TemplateEngineError("generatePublicationPackage: payload ausente ou invalido.");
  }
  const entry = getTemplateEntry(payload.templateKey);
  if (!entry) {
    throw new TemplateEngineError(`templateKey "${payload.templateKey}" nao existe no registry de templates.`);
  }
  const template = requireTemplate(payload.templateKey);
  const ctx = buildContext(payload, options);

  if (format === "story") return [template.buildStory(ctx)];

  if (!entry.supports.includes(format)) {
    throw new TemplateEngineError(`template "${entry.id}" nao suporta o formato "${format}" (suporta: ${entry.supports.join(", ")}).`);
  }

  if (format === "feed") {
    if (!template.buildFeed) throw new TemplateEngineError(`template "${entry.id}" declara suporte a feed mas nao implementa buildFeed.`);
    return [template.buildFeed(ctx)];
  }

  if (!template.buildCarousel) {
    throw new TemplateEngineError(`template "${entry.id}" declara suporte a carrossel mas nao implementa buildCarousel.`);
  }
  return template.buildCarousel(ctx).slice(0, entry.maxSlides);
}

async function rasterise(
  doc: RenderableDocument,
  payload: ContentPayload,
  format: OutputFormat,
  options: GeneratePackageOptions,
  slide?: { index: number; total: number },
  cache?: PreviewCacheKeyInput
): Promise<GeneratedImage> {
  const { buffer, width, height } = cache ? await renderCached(doc, cache, options.render) : await render(doc, options.render);
  const altText = buildAltText({
    title: payload.title,
    format,
    slideIndex: slide?.index,
    slideTotal: slide?.total,
    series: [payload.sourceSeries, ...payload.items].filter(Boolean) as Array<{ title: string }>
  });
  const suffix = slide ? `-${String(slide.index).padStart(2, "0")}-${doc.slideKey ?? "slide"}` : "";
  return {
    format,
    buffer,
    width,
    height,
    altText,
    fileName: `${slug(payload.templateKey)}-${format}${suffix}-${slug(payload.title)}.png`,
    slideIndex: slide?.index
  };
}

/** Zero-byte placeholder image record used by `dryRun` so callers keep the same shape. */
function emptyImage(doc: RenderableDocument, payload: ContentPayload, format: OutputFormat, slide?: { index: number; total: number }): GeneratedImage {
  return {
    format,
    buffer: Buffer.alloc(0),
    width: doc.viewport.width,
    height: doc.viewport.height,
    altText: buildAltText({
      title: payload.title,
      format,
      slideIndex: slide?.index,
      slideTotal: slide?.total,
      series: [payload.sourceSeries, ...payload.items].filter(Boolean) as Array<{ title: string }>
    }),
    fileName: `${slug(payload.templateKey)}-${format}${slide ? `-${slide.index}` : ""}-${slug(payload.title)}.png`,
    slideIndex: slide?.index
  };
}

/**
 * The public entry point. Produces every asset for a payload in one pass.
 * Rendering is sequential on purpose: a single shared Chromium, one page at a time, predictable
 * memory on the small server this will run on.
 */
export async function generatePublicationPackage(
  payload: ContentPayload,
  options: GeneratePackageOptions = {}
): Promise<PublicationPackage> {
  if (!payload || typeof payload !== "object") {
    throw new TemplateEngineError("generatePublicationPackage: payload ausente ou invalido.");
  }
  const entry = getTemplateEntry(payload.templateKey);
  if (!entry) {
    throw new TemplateEngineError(`templateKey "${payload.templateKey}" nao existe no registry de templates.`);
  }
  if (!entry.ativo) {
    throw new TemplateEngineError(`template "${entry.id}" esta inativo no registry — nada foi gerado.`);
  }

  const warnings: string[] = [];
  const themeResolution = resolveTheme(options.themeKey);
  if (themeResolution.fallbackApplied && options.themeKey) {
    warnings.push(`tema "${themeResolution.requested}" indisponivel — aplicado "${themeResolution.theme.key}".`);
  }
  if (options.allowRemoteImages) {
    warnings.push("allowRemoteImages=true: o render passa a depender da rede (posters remotos).");
  }

  const make = options.dryRun
    ? async (doc: RenderableDocument, format: OutputFormat, slide?: { index: number; total: number }) =>
        emptyImage(doc, payload, format, slide)
    : async (doc: RenderableDocument, format: OutputFormat, slide?: { index: number; total: number }) =>
        rasterise(doc, payload, format, options, slide);

  let feed: GeneratedImage | null = null;
  if (entry.supports.includes("feed")) {
    const [doc] = buildDocuments(payload, "feed", options);
    feed = await make(doc, "feed");
  }

  const carousel: GeneratedImage[] = [];
  if (entry.supports.includes("carousel")) {
    const docs = buildDocuments(payload, "carousel", options);
    for (let i = 0; i < docs.length; i++) {
      carousel.push(await make(docs[i], "carousel", { index: i + 1, total: docs.length }));
    }
  }

  // Story teaser: mandatory. Also the explicit ticket rule "sempre que ha feed/carrossel".
  const [storyDoc] = buildDocuments(payload, "story", options);
  const story = await make(storyDoc, "story");

  if (!feed && carousel.length === 0) {
    warnings.push(`template "${entry.id}" produziu apenas story — nenhum formato de feed/carrossel declarado.`);
  }
  if (!payload.cta?.text?.trim()) {
    warnings.push("payload.cta.text vazio — foi renderizado o CTA padrao do componente.");
  }

  return {
    templateKey: entry.id,
    themeKey: themeResolution.theme.key,
    feed,
    carousel,
    story,
    caption: payload.caption ?? "",
    ctaText: payload.cta?.text ?? "",
    hashtags: payload.hashtags ?? [],
    altTexts: [feed?.altText, ...carousel.map((image) => image.altText), story.altText].filter((value): value is string => Boolean(value)),
    recommendedTime: null,
    warnings
  };
}

/**
 * Single-format preview used by the admin route. Returns exactly one PNG (for a carousel, the
 * slide at `slideIndex`, default the cover) using the SAME renderer as the real package.
 */
export async function renderPreview(
  payload: ContentPayload,
  format: OutputFormat,
  options: GeneratePackageOptions & {
    slideIndex?: number;
    /**
     * When provided, the PNG is served from the renderer's short-TTL in-memory cache. The key
     * carries the content version, so an edited content invalidates itself naturally.
     */
    cache?: { contentId: string; version: string | number | Date };
  } = {}
): Promise<GeneratedImage> {
  const docs = buildDocuments(payload, format, options);
  const index = Math.min(Math.max(options.slideIndex ?? 0, 0), docs.length - 1);
  const doc = docs[index];
  const cacheInput: PreviewCacheKeyInput | undefined = options.cache
    ? {
        contentId: options.cache.contentId,
        version: options.cache.version,
        templateKey: payload.templateKey,
        format,
        slideIndex: index,
        themeKey: options.themeKey ?? null
      }
    : undefined;
  return rasterise(
    doc,
    payload,
    format,
    options,
    format === "carousel" ? { index: index + 1, total: docs.length } : undefined,
    cacheInput
  );
}

/** Which formats the admin toggle should offer for a given payload. Story is always available. */
export function availableFormats(templateKey: string): OutputFormat[] {
  const entry = getTemplateEntry(templateKey);
  if (!entry) return [];
  const formats = entry.supports.filter((format) => format !== "story");
  return [...formats, "story"];
}

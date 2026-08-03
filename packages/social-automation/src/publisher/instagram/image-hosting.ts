/**
 * INSERIES-SOCIAL-PUBLIC-MEDIA-STORAGE-07 — the publisher-side bridge to real object storage.
 *
 * ## What changed from ticket 05 (and why this file still exists)
 *
 * Ticket 05 declared an `ImageHostingService` here that could only *compose* URLs under
 * `SOCIAL_AUTOMATION_PUBLIC_MEDIA_BASE_URL`, because no object storage existed in the repository.
 * That gap is now closed by `src/media-hosting/` (Vercel Blob), which owns the ONLY
 * `ImageHostingService` in the codebase.
 *
 * Rather than leaving two divergent interfaces of the same name — the thing most likely to cause a
 * silent half-publish later — this file was reduced to a bridge:
 *
 *  - it RE-EXPORTS the single `ImageHostingService` from `../../media-hosting`, so the import path
 *    `./image-hosting` (and `publisher/index.ts`) keeps working for every existing call site;
 *  - it keeps only the publisher's own, narrower concern under an honest name,
 *    `PublicationMediaResolver`: "given a publication, give me public HTTPS URLs the Graph API can
 *    fetch". It renders through the Template Engine and delegates the bytes-to-URL step to the
 *    hosting service. It never talks to a storage provider itself.
 *
 * `ConfiguredImageHostingService` (the URL-composing class) is GONE on purpose: composing a URL for
 * a file nobody uploaded is exactly the failure mode this ticket exists to remove.
 */
import { createHash } from "node:crypto";
import {
  getImageHostingService,
  isMediaHostingError,
  MediaHostingError,
  MEDIA_STORAGE_NOT_CONFIGURED_MESSAGE,
  type ImageHostingService,
  type MediaAsset
} from "../../media-hosting";
import { PublishError } from "./errors";
import type { InstagramMediaKind } from "../types";
import type { ContentPayload } from "../../content-engine/types";

// The single storage contract, re-exported so nothing in the package needs to know it moved.
export {
  getImageHostingService,
  NotConfiguredImageHostingService,
  MediaHostingError,
  isMediaHostingError,
  MEDIA_STORAGE_NOT_CONFIGURED_MESSAGE
} from "../../media-hosting";
export type { ImageHostingService, HostedMedia, MediaAsset, MediaFormat } from "../../media-hosting";

export interface MediaReference {
  publicationId: string;
  /** `SocialPublication.contentId` — what the Template Engine needs to re-render the art. */
  contentId?: string | null;
  /** `SocialPublication.mediaRef` — today a `placeholder://…` string carrying only the format hint. */
  mediaRef: string | null;
  kind: InstagramMediaKind;
  /** For a carousel, the slide count hinted by `mediaRef`. Advisory: the template decides the truth. */
  slideCount?: number;
}

/** One rendered slide plus the content version that produced it (feeds the deterministic key). */
export interface RenderedSlide {
  buffer: Buffer;
  contentVersion: string;
}

/** Injected so this module never imports Playwright or Prisma at load time. */
export type PublicationSlideRenderer = (reference: MediaReference) => Promise<RenderedSlide[]>;

export interface PublicationMediaResolver {
  /** Public HTTPS URLs the Graph API can fetch, in slide order. Throws if hosting is unavailable. */
  resolvePublicUrls(reference: MediaReference): Promise<string[]>;
  /** Whether a real publish could succeed. Drives the admin panel's warning. */
  isConfigured(): boolean;
}

/**
 * `MediaHostingError` -> `PublishError`, so the retry policy keeps making ONE decision in ONE place:
 *   not-configured -> not-configured (never retried: a human must provision the store)
 *   validation     -> validation     (never retried: the bytes are wrong, retrying reproduces them)
 *   upload-failed  -> temporary      (retried with the same backoff a flaky Graph call gets)
 */
export function toPublishError(error: unknown): PublishError {
  if (error instanceof PublishError) return error;
  if (isMediaHostingError(error)) {
    const kind = error.kind === "upload-failed" ? "temporary" : error.kind;
    return new PublishError(kind, error.message, { cause: error });
  }
  return new PublishError("temporary", error instanceof Error ? error.message : String(error), { cause: error });
}

/**
 * The version of the CONTENT that produced these pixels. `SocialContent` has no `updatedAt`, so this
 * is a stable hash of the persisted payload — the SAME strategy the admin preview route already
 * uses. Any edit changes the hash, which changes the storage key, which produces a new asset instead
 * of silently serving stale art.
 */
function payloadVersion(payload: unknown): string {
  return createHash("sha1").update(JSON.stringify(payload ?? null)).digest("hex").slice(0, 16);
}

/**
 * The real renderer: SocialContent -> Template Engine -> PNG buffers. Imports are dynamic so merely
 * importing the publisher never opens a database connection or boots Chromium.
 */
export async function renderPublicationSlides(reference: MediaReference): Promise<RenderedSlide[]> {
  if (!reference.contentId) {
    throw new PublishError("validation", `Publicacao "${reference.publicationId}" nao aponta para nenhum SocialContent — nada a renderizar.`);
  }

  const { contentRepo } = await import("../../db/content-repo");
  const content = await contentRepo.findByIdWithRelations(reference.contentId);
  if (!content) {
    throw new PublishError("validation", `SocialContent "${reference.contentId}" nao encontrado — a publicacao nao tem arte para enviar.`);
  }

  const payload = content.payload as ContentPayload | null;
  if (!payload || typeof payload !== "object") {
    throw new PublishError("validation", `SocialContent "${reference.contentId}" nao tem payload valido do Content Engine.`);
  }

  const { buildDocuments, renderPreview } = await import("../../template-engine");
  const version = payloadVersion(content.payload);
  const total = reference.kind === "carousel" ? buildDocuments(payload, "carousel").length : 1;

  const slides: RenderedSlide[] = [];
  for (let index = 0; index < total; index++) {
    // Sequential on purpose: one shared Chromium, one page at a time (see template-engine/preview).
    const image = await renderPreview(payload, reference.kind, {
      slideIndex: index,
      cache: { contentId: content.id, version }
    });
    slides.push({ buffer: image.buffer, contentVersion: version });
  }
  return slides;
}

/**
 * The default resolver: render -> upload -> public URLs.
 *
 * The ordering guarantee this class exists to provide: for a carousel, EVERY slide is uploaded (in
 * order) and confirmed before a single URL is handed back. `uploadAll` is all-or-nothing, so a
 * failure on slide 3 rejects the whole batch and the caller never reaches the Graph API with a
 * partial set. Nothing here calls Meta — that is `instagram-publisher.ts`'s job, and it only ever
 * runs after this resolves.
 */
export class HostedPublicationMediaResolver implements PublicationMediaResolver {
  private readonly hosting: ImageHostingService;
  private readonly renderSlides: PublicationSlideRenderer;

  constructor(options: { hosting?: ImageHostingService; renderSlides?: PublicationSlideRenderer } = {}) {
    this.hosting = options.hosting ?? getImageHostingService();
    this.renderSlides = options.renderSlides ?? renderPublicationSlides;
  }

  isConfigured(): boolean {
    return this.hosting.isConfigured();
  }

  async resolvePublicUrls(reference: MediaReference): Promise<string[]> {
    // Checked BEFORE rendering: there is no point spending a Chromium render on bytes that have
    // nowhere to go, and the failure must be the honest "not-configured", not a render error.
    if (!this.hosting.isConfigured()) {
      throw toPublishError(new MediaHostingError("not-configured", MEDIA_STORAGE_NOT_CONFIGURED_MESSAGE));
    }

    let slides: RenderedSlide[];
    try {
      slides = await this.renderSlides(reference);
    } catch (error) {
      throw toPublishError(error);
    }

    if (slides.length === 0) {
      throw new PublishError("validation", `Publicacao "${reference.publicationId}" nao produziu nenhuma imagem para enviar.`);
    }

    const assets: MediaAsset[] = slides.map((slide, index) => ({
      publicationId: reference.publicationId,
      format: reference.kind,
      slideIndex: reference.kind === "carousel" ? index : 0,
      contentVersion: slide.contentVersion,
      buffer: slide.buffer
    }));

    try {
      const hosted = await this.hosting.uploadAll(assets);
      return hosted.map((item) => item.publicUrl);
    } catch (error) {
      throw toPublishError(error);
    }
  }
}

/**
 * Always refuses, before any render and before any Graph call. This is what a deployment without
 * `BLOB_READ_WRITE_TOKEN` gets, and it is a supported state — not a bug.
 */
export class NotConfiguredPublicationMediaResolver implements PublicationMediaResolver {
  isConfigured(): boolean {
    return false;
  }

  async resolvePublicUrls(): Promise<string[]> {
    throw toPublishError(new MediaHostingError("not-configured", MEDIA_STORAGE_NOT_CONFIGURED_MESSAGE));
  }
}

/** Picks the implementation from the storage config. The only place that decision is made. */
export function createPublicationMediaResolver(hosting: ImageHostingService = getImageHostingService()): PublicationMediaResolver {
  return hosting.isConfigured() ? new HostedPublicationMediaResolver({ hosting }) : new NotConfiguredPublicationMediaResolver();
}

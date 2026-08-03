/**
 * INSERIES-INSTAGRAM-PUBLISHER-05 — the real `Publisher` for Instagram.
 *
 * Implements the pre-existing `Publisher` contract (`publish(publication) => { externalId }`) so
 * `manual-flow/index.ts` and `getPublisher(network)` keep working untouched — this class simply
 * replaces `ConsoleLogPublisher` in the registry when, and only when, real credentials exist AND
 * `isRealPublishAllowed()` (see ../registry.ts).
 *
 * It owns the *sequencing* of the Content Publishing API (which containers, in which order, with
 * which validation) and nothing else: every byte on the wire goes through `InstagramGraphClient`,
 * every retry decision belongs to `retries/retry-policy.ts`, every DB write belongs to
 * `services/publish-service.ts`.
 */
import { logger } from "../../logger";
import { CAROUSEL_MAX_ITEMS, CAROUSEL_MIN_ITEMS, InstagramGraphClient } from "./graph-client";
import { PublishError } from "./errors";
import { createImageHostingService, type ImageHostingService } from "./image-hosting";
import type { ContainerStatus, InstagramMediaKind, InstagramPublishRequest, Publisher, PublishResult } from "../types";
import type { SocialPublication } from "@prisma/client";

/** Instagram's own caption limit. Sending more is a guaranteed rejection. */
export const CAPTION_MAX_LENGTH = 2_200;

export type PublishStage = "media-resolved" | "uploading" | "uploaded" | "publishing" | "published";

export interface InstagramPublisherOptions {
  client?: InstagramGraphClient;
  imageHosting?: ImageHostingService;
  /** Lets publish-service.ts move the row through UPLOADING/PUBLISHING as the API progresses. */
  onStage?: (stage: PublishStage, detail: { publicationId: string; creationId?: string }) => void | Promise<void>;
  /** Injected in tests so container polling does not actually wait. */
  sleep?: (ms: number) => Promise<void>;
  /** Container polling attempts. */
  containerPollAttempts?: number;
}

/**
 * `SocialPublication.mediaRef` is a free-form string today (`PlaceholderMediaGenerator` writes
 * `placeholder://…`). The kind/slide-count are read from it when present so the publisher never has
 * to reach back into the Template Engine or the content payload:
 *
 *   "…#feed"              -> feed, 1 image
 *   "…#story"             -> story, 1 image
 *   "…#carousel:4"        -> carousel, 4 slides
 *
 * Anything else (including `null`) is treated as a single feed image — the historical default.
 */
export function parseMediaRef(mediaRef: string | null): { kind: InstagramMediaKind; slideCount: number } {
  const hash = mediaRef?.split("#").pop()?.toLowerCase() ?? "";

  if (hash === "story") return { kind: "story", slideCount: 1 };
  if (hash.startsWith("carousel")) {
    const parsed = Number(hash.split(":")[1]);
    return { kind: "carousel", slideCount: Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : CAROUSEL_MIN_ITEMS };
  }
  return { kind: "feed", slideCount: 1 };
}

/** Defensive boundary validation — runs before a single byte is sent. */
export function assertValidRequest(request: InstagramPublishRequest): void {
  if (request.imageUrls.length === 0) {
    throw new PublishError("validation", `Publicacao "${request.publicationId}" nao tem nenhuma imagem para publicar.`);
  }
  for (const url of request.imageUrls) {
    if (!/^https:\/\/.+/i.test(url)) {
      throw new PublishError("validation", `image_url precisa ser HTTPS publica — recebido "${url.slice(0, 60)}".`);
    }
  }
  if (request.kind === "carousel") {
    // The template registry already caps maxSlides at 10; re-checked here on purpose (ticket:
    // "o Publisher deve validar de novo na fronteira, defensivamente").
    if (request.imageUrls.length < CAROUSEL_MIN_ITEMS || request.imageUrls.length > CAROUSEL_MAX_ITEMS) {
      throw new PublishError(
        "validation",
        `Carrossel do Instagram aceita de ${CAROUSEL_MIN_ITEMS} a ${CAROUSEL_MAX_ITEMS} itens — recebidos ${request.imageUrls.length}.`
      );
    }
  } else if (request.imageUrls.length !== 1) {
    throw new PublishError("validation", `Formato "${request.kind}" aceita exatamente 1 imagem — recebidas ${request.imageUrls.length}.`);
  }
  if (request.kind !== "story" && request.caption.length > CAPTION_MAX_LENGTH) {
    throw new PublishError("validation", `Legenda tem ${request.caption.length} caracteres — o limite do Instagram e ${CAPTION_MAX_LENGTH}.`);
  }
}

export class InstagramGraphPublisher implements Publisher {
  private readonly client: InstagramGraphClient;
  private readonly imageHosting: ImageHostingService;
  private readonly onStage: InstagramPublisherOptions["onStage"];
  private readonly sleep?: (ms: number) => Promise<void>;
  private readonly containerPollAttempts: number;

  constructor(options: InstagramPublisherOptions = {}) {
    this.client = options.client ?? new InstagramGraphClient();
    this.imageHosting = options.imageHosting ?? createImageHostingService();
    this.onStage = options.onStage;
    this.sleep = options.sleep;
    this.containerPollAttempts = options.containerPollAttempts ?? 5;
  }

  /** Whether a real publish could even be attempted. Surfaced by publisher/status.ts. */
  isMediaHostingConfigured(): boolean {
    return this.imageHosting.isConfigured();
  }

  private async stage(name: PublishStage, publicationId: string, creationId?: string): Promise<void> {
    logger.info(`publisher:instagram:${name}`, { module: "publisher", metadata: { publicationId, creationId } });
    await this.onStage?.(name, { publicationId, creationId });
  }

  /** The `Publisher` contract. Resolves media, then delegates to `publishRequest`. */
  async publish(publication: SocialPublication): Promise<PublishResult> {
    const { kind, slideCount } = parseMediaRef(publication.mediaRef);

    const imageUrls = await this.imageHosting.resolvePublicUrls({
      publicationId: publication.id,
      mediaRef: publication.mediaRef,
      kind,
      slideCount
    });

    await this.stage("media-resolved", publication.id);

    return this.publishRequest({
      publicationId: publication.id,
      kind,
      caption: publication.caption,
      imageUrls
    });
  }

  /** The Graph API sequence proper. Exposed separately so tests can drive it without a DB row. */
  async publishRequest(request: InstagramPublishRequest): Promise<PublishResult> {
    assertValidRequest(request);

    await this.stage("uploading", request.publicationId);

    const creationId =
      request.kind === "carousel"
        ? await this.createCarousel(request)
        : request.kind === "story"
          ? await this.client.createStoryContainer({ imageUrl: request.imageUrls[0] })
          : await this.client.createImageContainer({ imageUrl: request.imageUrls[0], caption: request.caption });

    await this.stage("uploaded", request.publicationId, creationId);

    await this.waitForContainer(creationId);

    await this.stage("publishing", request.publicationId, creationId);
    const externalId = await this.client.publishContainer(creationId);
    await this.stage("published", request.publicationId, externalId);

    return { externalId };
  }

  /** One child container per slide (sequential — parallel uploads only make rate limits worse). */
  private async createCarousel(request: InstagramPublishRequest): Promise<string> {
    const childIds: string[] = [];
    for (const imageUrl of request.imageUrls) {
      childIds.push(await this.client.createCarouselItemContainer({ imageUrl }));
    }
    return this.client.createCarouselContainer({ childIds, caption: request.caption });
  }

  private waitForContainer(creationId: string): Promise<ContainerStatus> {
    return this.client.waitForContainer(creationId, {
      attempts: this.containerPollAttempts,
      ...(this.sleep ? { sleep: this.sleep } : {})
    });
  }

  /** "Atualizar status" in the admin panel: asks Meta what it currently thinks of a container. */
  getContainerStatus(creationId: string): Promise<ContainerStatus> {
    return this.client.getContainerStatus(creationId);
  }
}

/**
 * INSERIES-INSTAGRAM-PUBLISHER-05 — resolving a publication's media into PUBLIC HTTPS URLs.
 *
 * ## The infrastructure gap (read this before "fixing" it)
 *
 * The Content Publishing API does not accept a binary upload in this flow: `POST /{ig-user-id}/media`
 * takes an `image_url` that Meta's servers fetch themselves, anonymously, from the public internet.
 *
 * The Template Engine (`template-engine/preview/index.ts`) returns PNGs as in-memory `Buffer`s. The
 * only HTTP surface that serves them today is `/api/admin/social/content/[id]/preview/[format]`,
 * which is gated by `getAdminApiUser("admin.social")` — Meta's fetcher has no admin session, so
 * that route can NOT be used as `image_url`.
 *
 * There is no object storage configured anywhere in this repository, and inventing one (S3, Vercel
 * Blob, …) is an infrastructure decision outside this ticket's scope. So this module states the gap
 * instead of hiding it:
 *
 *  - `ConfiguredImageHostingService` builds URLs under `SOCIAL_AUTOMATION_PUBLIC_MEDIA_BASE_URL`
 *    once somebody actually stands up a public, unauthenticated media host and points that env var
 *    at it. It only *composes* URLs — it does not upload anything, because there is nothing to
 *    upload to yet.
 *  - `NotConfiguredImageHostingService` is what you get when that env var is unset. It throws a
 *    clear, non-retryable `PublishError("not-configured")`.
 *
 * Dev/homologation and every test are unaffected: the registry keeps `ConsoleLogPublisher` there,
 * so this service is only ever reached on a real production publish.
 */
import { metaConfig, type MetaConfig } from "../../config";
import { PublishError } from "./errors";

export interface MediaReference {
  publicationId: string;
  /** `SocialPublication.mediaRef` — today a `placeholder://…` string from PlaceholderMediaGenerator. */
  mediaRef: string | null;
  kind: "feed" | "carousel" | "story";
  /** For a carousel, how many slides to resolve. Ignored for feed/story. */
  slideCount?: number;
}

export interface ImageHostingService {
  /** Public HTTPS URLs the Graph API can fetch, in slide order. Throws if hosting is unavailable. */
  resolvePublicUrls(reference: MediaReference): Promise<string[]>;
  /** Whether a real publish could succeed. Drives the admin panel's warning. */
  isConfigured(): boolean;
}

export const IMAGE_HOSTING_NOT_CONFIGURED_MESSAGE =
  "Hospedagem de imagem publica nao configurada — a Meta Graph API precisa buscar o PNG por uma URL HTTPS anonima. " +
  "Configure SOCIAL_AUTOMATION_PUBLIC_MEDIA_BASE_URL apontando para um host publico dos arquivos gerados pelo Template Engine. " +
  "A rota /api/admin/social/content/[id]/preview/[format] NAO serve: exige sessao de admin.";

/** The default in every environment that has no public media host. Always throws, never guesses. */
export class NotConfiguredImageHostingService implements ImageHostingService {
  isConfigured(): boolean {
    return false;
  }

  async resolvePublicUrls(): Promise<string[]> {
    throw new PublishError("not-configured", IMAGE_HOSTING_NOT_CONFIGURED_MESSAGE);
  }
}

/**
 * Composes `${base}/${publicationId}/{feed|story|carousel-01}.png`. Whoever configures the base URL
 * owns publishing the files at that layout — this class deliberately makes no upload call, so it
 * cannot pretend a storage backend exists.
 */
export class ConfiguredImageHostingService implements ImageHostingService {
  private readonly baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl.replace(/\/+$/, "");
  }

  isConfigured(): boolean {
    return true;
  }

  async resolvePublicUrls(reference: MediaReference): Promise<string[]> {
    const prefix = `${this.baseUrl}/${encodeURIComponent(reference.publicationId)}`;

    if (reference.kind === "carousel") {
      const count = reference.slideCount ?? 0;
      if (count < 2) {
        throw new PublishError("validation", `Carrossel da publicacao "${reference.publicationId}" precisa de ao menos 2 slides — recebido ${count}.`);
      }
      return Array.from({ length: count }, (_, index) => `${prefix}/carousel-${String(index + 1).padStart(2, "0")}.png`);
    }

    return [`${prefix}/${reference.kind}.png`];
  }
}

/** Picks the implementation from config. The only place that decision is made. */
export function createImageHostingService(config: MetaConfig = metaConfig): ImageHostingService {
  return config.publicMediaBaseUrl ? new ConfiguredImageHostingService(config.publicMediaBaseUrl) : new NotConfiguredImageHostingService();
}

/**
 * INSERIES-SOCIAL-PUBLIC-MEDIA-STORAGE-07 — the real provider, on Vercel Blob.
 *
 * ## Why Vercel Blob
 * The app already deploys to Vercel, so this is the one object store that needs no extra account,
 * no extra egress bill and no extra secret-management story: a single `BLOB_READ_WRITE_TOKEN`
 * (the name `@vercel/blob` reads by itself) and public objects are served over HTTPS from a CDN
 * that Meta's anonymous fetcher can reach.
 *
 * ## Idempotency without a database
 * The ticket forbids a new table, so "did I already upload this?" is answered by the key itself
 * (`key.ts`): it embeds the sha256 of the bytes. Before uploading, `head()` is consulted; a hit
 * means an object with that exact key — and therefore those exact bytes — is already online, so the
 * upload is skipped and `reused: true` is returned. `addRandomSuffix: false` is what makes the
 * stored pathname equal the computed key; with a random suffix the whole scheme would collapse.
 *
 * ## Secrets
 * The token is passed explicitly to every call (never read implicitly, so tests can't accidentally
 * pick up a real one) and every error message crosses `maskText()` before it is thrown or logged —
 * `@vercel/blob` echoes the token back inside some failures.
 */
import { del, head, list, put } from "@vercel/blob";
import { mediaStorageConfig, type MediaStorageConfig } from "../config";
import { logger } from "../logger";
import { maskText } from "../publisher/utils/mask";
import { buildMediaKey, isInsidePrefix } from "./key";
import { validateAsset } from "./validation";
import {
  MediaHostingError,
  PNG_CONTENT_TYPE,
  type CleanupCandidate,
  type HostedMedia,
  type HostingHealth,
  type ImageHostingService,
  type MediaAsset
} from "./types";

export const VERCEL_BLOB_PROVIDER = "vercel-blob";

/** Uploads are network calls: their failure is `upload-failed` (retryable), never `validation`. */
function toUploadError(operation: string, error: unknown): MediaHostingError {
  const raw = error instanceof Error ? error.message : String(error);
  return new MediaHostingError("upload-failed", `Falha ao ${operation} no Vercel Blob: ${maskText(raw)}`, { cause: error });
}

export class VercelBlobImageHostingService implements ImageHostingService {
  readonly provider = VERCEL_BLOB_PROVIDER;
  private readonly config: MediaStorageConfig;

  constructor(config: MediaStorageConfig = mediaStorageConfig) {
    if (!config.token) {
      throw new MediaHostingError("not-configured", "VercelBlobImageHostingService exige BLOB_READ_WRITE_TOKEN — use getImageHostingService().");
    }
    this.config = config;
  }

  isConfigured(): boolean {
    return true;
  }

  private get token(): string {
    return this.config.token as string;
  }

  private expiresAt(createdAt: Date): Date {
    return new Date(createdAt.getTime() + this.config.retentionHours * 3_600_000);
  }

  /**
   * Validate -> compute key -> reuse-or-upload. The order is deliberate: nothing invalid ever
   * reaches the network, and the key can only be computed once the checksum exists.
   */
  async upload(asset: MediaAsset): Promise<HostedMedia> {
    const validated = validateAsset(asset, this.config);
    const pathname = buildMediaKey(
      {
        publicationId: asset.publicationId,
        format: asset.format,
        slideIndex: asset.slideIndex,
        contentVersion: asset.contentVersion,
        checksum: validated.checksum
      },
      this.config
    );

    const existing = await this.findExisting(pathname);
    if (existing && existing.size === validated.size) {
      logger.info("media-hosting:upload:reutilizado", {
        module: "media-hosting",
        metadata: { pathname, size: existing.size, publicationId: asset.publicationId, slideIndex: asset.slideIndex }
      });
      return {
        id: pathname,
        publicUrl: existing.url,
        contentType: validated.contentType,
        size: existing.size,
        checksum: validated.checksum,
        createdAt: existing.uploadedAt,
        expiresAt: this.expiresAt(existing.uploadedAt),
        provider: this.provider,
        reused: true
      };
    }

    let result: { url: string; pathname: string };
    try {
      result = await put(pathname, asset.buffer, {
        access: "public",
        contentType: PNG_CONTENT_TYPE,
        addRandomSuffix: false,
        token: this.token
      });
    } catch (error) {
      throw toUploadError(`enviar "${pathname}"`, error);
    }

    const createdAt = new Date();
    logger.info("media-hosting:upload:concluido", {
      module: "media-hosting",
      metadata: {
        pathname: result.pathname ?? pathname,
        size: validated.size,
        publicationId: asset.publicationId,
        slideIndex: asset.slideIndex,
        // The public Blob URL carries no credential today; masked anyway rather than trusting that.
        url: maskText(result.url)
      }
    });

    return {
      id: result.pathname ?? pathname,
      publicUrl: result.url,
      contentType: validated.contentType,
      size: validated.size,
      checksum: validated.checksum,
      createdAt,
      expiresAt: this.expiresAt(createdAt),
      provider: this.provider,
      reused: false
    };
  }

  /**
   * All-or-nothing, and SEQUENTIAL: a carousel's slides must land in order, and a parallel burst
   * only makes provider rate limits worse. On the first failure the whole batch rejects, so the
   * caller can never publish a partial carousel. Slides already uploaded are intentionally left in
   * place — they are addressed by a deterministic key, so the retry reuses them for free, and the
   * retention policy collects them if the publication is abandoned.
   */
  async uploadAll(assets: MediaAsset[]): Promise<HostedMedia[]> {
    const uploaded: HostedMedia[] = [];
    for (const asset of assets) {
      try {
        uploaded.push(await this.upload(asset));
      } catch (error) {
        logger.error("media-hosting:upload:lote-abortado", {
          module: "media-hosting",
          metadata: {
            publicationId: asset.publicationId,
            falhouNoSlide: asset.slideIndex,
            slidesJaEnviados: uploaded.map((item) => item.id),
            total: assets.length,
            error: maskText(error instanceof Error ? error.message : String(error))
          }
        });
        throw error;
      }
    }
    return uploaded;
  }

  /** `head()` throws when the object is absent — that is a MISS, not a failure. */
  private async findExisting(pathname: string): Promise<{ url: string; size: number; uploadedAt: Date } | null> {
    try {
      const found = await head(pathname, { token: this.token });
      if (!found) return null;
      return { url: found.url, size: found.size, uploadedAt: new Date(found.uploadedAt) };
    } catch {
      return null;
    }
  }

  /** Idempotent by contract: deleting something already gone resolves `false` instead of throwing. */
  async remove(target: string): Promise<boolean> {
    const pathname = this.toPathname(target);
    if (!isInsidePrefix(pathname, this.config)) {
      throw new MediaHostingError(
        "validation",
        `Recusado remover "${pathname}": fora do prefixo "${this.config.prefix}". Este servico nunca opera fora do proprio prefixo.`
      );
    }

    const existing = await this.findExisting(pathname);
    if (!existing) {
      logger.info("media-hosting:remove:inexistente", { module: "media-hosting", metadata: { pathname } });
      return false;
    }

    try {
      await del(existing.url, { token: this.token });
    } catch (error) {
      throw toUploadError(`remover "${pathname}"`, error);
    }
    logger.info("media-hosting:remove:ok", { module: "media-hosting", metadata: { pathname } });
    return true;
  }

  /** Accepts a full public URL or a pathname; always yields the pathname the prefix guard checks. */
  private toPathname(target: string): string {
    if (!/^https?:\/\//i.test(target)) return target.replace(/^\/+/, "");
    try {
      return new URL(target).pathname.replace(/^\/+/, "");
    } catch {
      return target;
    }
  }

  /**
   * Always scoped to the configured prefix. A caller-supplied prefix may only NARROW it — never
   * widen it — so no code path can enumerate (and then delete) somebody else's objects.
   */
  async list(prefix?: string): Promise<CleanupCandidate[]> {
    const scoped = prefix && isInsidePrefix(prefix, this.config) ? prefix : this.config.prefix;
    const candidates: CleanupCandidate[] = [];
    let cursor: string | undefined;

    try {
      do {
        const page = await list({ prefix: scoped, token: this.token, ...(cursor ? { cursor } : {}) });
        for (const blob of page.blobs) {
          if (!isInsidePrefix(blob.pathname, this.config)) continue;
          candidates.push({
            pathname: blob.pathname,
            publicUrl: blob.url,
            uploadedAt: new Date(blob.uploadedAt),
            size: blob.size
          });
        }
        cursor = page.hasMore ? page.cursor : undefined;
      } while (cursor);
    } catch (error) {
      throw toUploadError(`listar "${scoped}"`, error);
    }

    return candidates;
  }

  /**
   * Non-destructive by default: it only proves the prefix can be listed. `{ write: true }` is the
   * explicit administrative test — it uploads a 1x1 PNG under `_health/` and deletes it again, and
   * is only ever reached from the admin route when a human presses the button.
   */
  async health(options: { write?: boolean } = {}): Promise<HostingHealth> {
    const base: HostingHealth = {
      configured: true,
      provider: this.provider,
      prefix: this.config.prefix,
      retentionHours: this.config.retentionHours,
      reachable: false,
      objectCount: null,
      writeTested: false,
      error: null,
      checkedAt: new Date()
    };

    let objects: CleanupCandidate[];
    try {
      objects = await this.list();
    } catch (error) {
      return { ...base, error: maskText(error instanceof Error ? error.message : String(error)) };
    }

    const reachable: HostingHealth = { ...base, reachable: true, objectCount: objects.length };
    if (!options.write) return reachable;

    const pathname = `${this.config.prefix}_health/${Date.now()}-check.png`;
    try {
      const written = await put(pathname, HEALTH_CHECK_PNG, {
        access: "public",
        contentType: PNG_CONTENT_TYPE,
        addRandomSuffix: false,
        token: this.token
      });
      await del(written.url, { token: this.token });
      return { ...reachable, writeTested: true };
    } catch (error) {
      return { ...reachable, writeTested: false, error: maskText(error instanceof Error ? error.message : String(error)) };
    }
  }
}

/**
 * A real, minimal 1x1 PNG used only by the explicit write test. Kept as literal bytes so the health
 * check needs no renderer, no Chromium and no fixture file.
 */
export const HEALTH_CHECK_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64"
);

/**
 * INSERIES-SOCIAL-PUBLIC-MEDIA-STORAGE-07 — the default in every environment without a Blob token.
 *
 * This is NOT a broken state, it is the correct one: with no public object storage there is no way
 * to give Meta an `image_url` it can fetch, so the only honest behaviour is to fail fast, loudly,
 * and non-retryably BEFORE any Graph API call is made. Nothing here ever guesses a URL.
 *
 * It supersedes the class of the same name that lived in `publisher/instagram/image-hosting.ts`
 * (ticket 05), which could only refuse to *compose* a URL; this one refuses to *upload*, which is
 * the operation that actually matters now.
 */
import { mediaStorageConfig, type MediaStorageConfig } from "../config";
import { MediaHostingError, type CleanupCandidate, type HostedMedia, type HostingHealth, type ImageHostingService } from "./types";

export const MEDIA_STORAGE_NOT_CONFIGURED_MESSAGE =
  "Hospedagem publica de midia nao configurada — a Meta Graph API busca o PNG por uma URL HTTPS anonima, " +
  "entao nenhuma publicacao real pode acontecer sem storage. Configure BLOB_READ_WRITE_TOKEN (Vercel Blob) " +
  "e mantenha SOCIAL_MEDIA_STORAGE_PROVIDER=vercel-blob. " +
  "A rota /api/admin/social/content/[id]/preview/[format] NAO serve: exige sessao de admin.";

export class NotConfiguredImageHostingService implements ImageHostingService {
  readonly provider = "nao-configurado";
  private readonly config: MediaStorageConfig;

  constructor(config: MediaStorageConfig = mediaStorageConfig) {
    this.config = config;
  }

  isConfigured(): boolean {
    return false;
  }

  private fail(): never {
    const warning = this.config.providerWarning ? ` ${this.config.providerWarning}` : "";
    throw new MediaHostingError("not-configured", `${MEDIA_STORAGE_NOT_CONFIGURED_MESSAGE}${warning}`);
  }

  async upload(): Promise<HostedMedia> {
    this.fail();
  }

  async uploadAll(): Promise<HostedMedia[]> {
    this.fail();
  }

  /** Deleting from a storage that does not exist is a no-op, not an error — keeps cleanup idempotent. */
  async remove(): Promise<boolean> {
    return false;
  }

  /** Nothing is hosted, so there is nothing to list. Empty, never a throw — cleanup must stay safe. */
  async list(): Promise<CleanupCandidate[]> {
    return [];
  }

  async health(): Promise<HostingHealth> {
    return {
      configured: false,
      provider: this.provider,
      prefix: this.config.prefix,
      retentionHours: this.config.retentionHours,
      reachable: false,
      objectCount: null,
      writeTested: false,
      error: this.config.providerWarning ?? MEDIA_STORAGE_NOT_CONFIGURED_MESSAGE,
      checkedAt: new Date()
    };
  }
}

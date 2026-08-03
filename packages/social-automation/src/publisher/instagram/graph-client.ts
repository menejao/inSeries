/**
 * INSERIES-INSTAGRAM-PUBLISHER-05 — the ONE file in this package that talks HTTP to the Meta
 * Graph API. Nothing else anywhere may call `fetch` against graph.facebook.com: authentication,
 * container creation, publishing, status polling and error translation all live here, so there is
 * a single place to audit for credential leaks, timeouts and error handling.
 *
 * No new dependency: Node 22's global `fetch` + `AbortController`. The `fetch` implementation is
 * injectable (`GraphClientOptions.fetchImpl`) purely so tests can drive it without a network —
 * every test in this ticket injects a fake and NO test ever reaches the real API.
 *
 * Content Publishing API flow implemented here (public documentation):
 *   feed:     POST /{ig-user-id}/media {image_url, caption}          -> creation_id
 *             POST /{ig-user-id}/media_publish {creation_id}         -> id
 *   carousel: POST /{ig-user-id}/media {image_url, is_carousel_item} -> child id  (x2..10)
 *             POST /{ig-user-id}/media {media_type: CAROUSEL, children, caption}
 *             POST /{ig-user-id}/media_publish {creation_id}
 *   story:    POST /{ig-user-id}/media {image_url, media_type: STORIES}
 *             POST /{ig-user-id}/media_publish {creation_id}
 *   status:   GET  /{creation_id}?fields=status_code
 */
import { metaConfig, type MetaConfig } from "../../config";
import { logger } from "../../logger";
import { maskSecret, maskText } from "../utils/mask";
import { classifyGraphError, PublishError } from "./errors";
import type { ContainerStatus, ContainerStatusCode } from "../types";

export const CAROUSEL_MIN_ITEMS = 2;
export const CAROUSEL_MAX_ITEMS = 10;

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export interface GraphClientOptions {
  config?: MetaConfig;
  fetchImpl?: FetchLike;
  /** Overrides `config.requestTimeoutMs`. */
  timeoutMs?: number;
  /** Only overridden by tests that assert URL shape. */
  baseUrl?: string;
}

interface GraphErrorBody {
  error?: { message?: string; code?: number; error_subcode?: number; type?: string };
}

export class InstagramGraphClient {
  private readonly config: MetaConfig;
  private readonly fetchImpl: FetchLike;
  private readonly timeoutMs: number;
  private readonly baseUrl: string;

  constructor(options: GraphClientOptions = {}) {
    this.config = options.config ?? metaConfig;
    this.fetchImpl = options.fetchImpl ?? ((input, init) => fetch(input, init));
    this.timeoutMs = options.timeoutMs ?? this.config.requestTimeoutMs;
    this.baseUrl = options.baseUrl ?? "https://graph.facebook.com";
  }

  /** Business account id, validated once so every call site can assume it exists. */
  private igUserId(): string {
    const id = this.config.instagramBusinessAccountId;
    if (!id) {
      throw new PublishError("not-configured", "INSTAGRAM_BUSINESS_ACCOUNT_ID nao configurado — impossivel falar com a Graph API.");
    }
    return id;
  }

  private accessToken(): string {
    const token = this.config.accessToken;
    if (!token) {
      throw new PublishError("auth", "META_ACCESS_TOKEN nao configurado — impossivel autenticar na Graph API.");
    }
    return token;
  }

  private url(path: string): string {
    return `${this.baseUrl}/${this.config.apiVersion}/${path.replace(/^\/+/, "")}`;
  }

  /**
   * Single HTTP entry point. The access token travels in the Authorization header rather than the
   * query string so it never lands in a URL that could be logged by an intermediary.
   */
  private async request<T>(method: "GET" | "POST", path: string, params: Record<string, string> = {}): Promise<T> {
    const token = this.accessToken();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    const isGet = method === "GET";
    const query = isGet ? `?${new URLSearchParams(params).toString()}` : "";
    const url = `${this.url(path)}${isGet && Object.keys(params).length > 0 ? query : ""}`;

    let response: Response;
    try {
      response = await this.fetchImpl(url, {
        method,
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${token}`,
          ...(isGet ? {} : { "Content-Type": "application/x-www-form-urlencoded" })
        },
        ...(isGet ? {} : { body: new URLSearchParams(params).toString() })
      });
    } catch (error) {
      const aborted = error instanceof Error && (error.name === "AbortError" || /abort/i.test(error.message));
      throw new PublishError(
        aborted ? "timeout" : "temporary",
        aborted
          ? `Graph API nao respondeu em ${this.timeoutMs}ms (${method} ${path}).`
          : `Falha de rede ao chamar a Graph API (${method} ${path}): ${error instanceof Error ? error.message : String(error)}`,
        { cause: error }
      );
    } finally {
      clearTimeout(timer);
    }

    const text = await response.text().catch(() => "");
    let body: unknown = null;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      body = null;
    }

    if (!response.ok || (body as GraphErrorBody | null)?.error) {
      const graphError = (body as GraphErrorBody | null)?.error;
      const code = typeof graphError?.code === "number" ? graphError.code : null;
      const subcode = typeof graphError?.error_subcode === "number" ? graphError.error_subcode : null;
      const kind = classifyGraphError(code, subcode, response.status);
      const message = graphError?.message ?? maskText(text.slice(0, 300)) ?? "erro desconhecido";

      logger.warn("publisher:instagram:graph-error", {
        module: "publisher",
        metadata: { method, path, httpStatus: response.status, graphCode: code, graphSubcode: subcode, kind }
      });

      throw new PublishError(kind, `Graph API respondeu ${response.status} (${method} ${path}): ${message}`, {
        graphCode: code,
        graphSubcode: subcode,
        httpStatus: response.status
      });
    }

    return body as T;
  }

  /** Sanity-check that the configured token can read the business account. Used by "testar conexao". */
  async verifyCredentials(): Promise<{ id: string; username?: string }> {
    logger.info("publisher:instagram:verify-credentials", {
      module: "publisher",
      metadata: { igUserId: maskSecret(this.config.instagramBusinessAccountId), token: maskSecret(this.config.accessToken) }
    });
    return this.request<{ id: string; username?: string }>("GET", this.igUserId(), { fields: "id,username" });
  }

  /** POST /{ig-user-id}/media for a single feed image. Returns the container id (creation_id). */
  async createImageContainer(input: { imageUrl: string; caption: string }): Promise<string> {
    const { id } = await this.request<{ id: string }>("POST", `${this.igUserId()}/media`, {
      image_url: input.imageUrl,
      caption: input.caption
    });
    return id;
  }

  /** POST /{ig-user-id}/media with media_type=STORIES. Stories carry no caption. */
  async createStoryContainer(input: { imageUrl: string }): Promise<string> {
    const { id } = await this.request<{ id: string }>("POST", `${this.igUserId()}/media`, {
      image_url: input.imageUrl,
      media_type: "STORIES"
    });
    return id;
  }

  /** POST /{ig-user-id}/media with is_carousel_item=true. One call per slide. */
  async createCarouselItemContainer(input: { imageUrl: string }): Promise<string> {
    const { id } = await this.request<{ id: string }>("POST", `${this.igUserId()}/media`, {
      image_url: input.imageUrl,
      is_carousel_item: "true"
    });
    return id;
  }

  /**
   * POST /{ig-user-id}/media with media_type=CAROUSEL. The 2..10 limit is Meta's, revalidated here
   * at the HTTP boundary even though instagram-publisher.ts already checks it — a wrong count is a
   * guaranteed 400 and there is no reason to spend a real API call discovering that.
   */
  async createCarouselContainer(input: { childIds: string[]; caption: string }): Promise<string> {
    if (input.childIds.length < CAROUSEL_MIN_ITEMS || input.childIds.length > CAROUSEL_MAX_ITEMS) {
      throw new PublishError(
        "validation",
        `Carrossel do Instagram aceita de ${CAROUSEL_MIN_ITEMS} a ${CAROUSEL_MAX_ITEMS} itens — recebidos ${input.childIds.length}.`
      );
    }
    const { id } = await this.request<{ id: string }>("POST", `${this.igUserId()}/media`, {
      media_type: "CAROUSEL",
      children: input.childIds.join(","),
      caption: input.caption
    });
    return id;
  }

  /** POST /{ig-user-id}/media_publish. Returns the real Instagram media id. */
  async publishContainer(creationId: string): Promise<string> {
    const { id } = await this.request<{ id: string }>("POST", `${this.igUserId()}/media_publish`, { creation_id: creationId });
    return id;
  }

  /** GET /{creation_id}?fields=status_code. */
  async getContainerStatus(creationId: string): Promise<ContainerStatus> {
    const body = await this.request<{ status_code?: string; status?: string }>("GET", creationId, {
      fields: "status_code,status"
    });
    const raw = (body.status_code ?? "").toUpperCase();
    const known: ContainerStatusCode[] = ["IN_PROGRESS", "FINISHED", "ERROR", "EXPIRED", "PUBLISHED"];
    const statusCode = (known as string[]).includes(raw) ? (raw as ContainerStatusCode) : "IN_PROGRESS";
    return { creationId, statusCode, message: body.status ? maskText(body.status) : null };
  }

  /**
   * Polls `getContainerStatus` until the container leaves IN_PROGRESS. Meta processes the image
   * asynchronously; publishing a container that is not FINISHED fails with a confusing error.
   */
  async waitForContainer(creationId: string, options: { attempts?: number; delayMs?: number; sleep?: (ms: number) => Promise<void> } = {}): Promise<ContainerStatus> {
    const attempts = options.attempts ?? 5;
    const delayMs = options.delayMs ?? 2_000;
    const sleep = options.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));

    let last: ContainerStatus = { creationId, statusCode: "IN_PROGRESS", message: null };
    for (let attempt = 0; attempt < attempts; attempt++) {
      last = await this.getContainerStatus(creationId);
      if (last.statusCode === "FINISHED" || last.statusCode === "PUBLISHED") return last;
      if (last.statusCode === "ERROR") {
        throw new PublishError("invalid-media", `Container ${creationId} falhou no processamento da Meta: ${last.message ?? "sem detalhe"}.`);
      }
      if (last.statusCode === "EXPIRED") {
        throw new PublishError("temporary", `Container ${creationId} expirou antes da publicacao.`);
      }
      if (attempt < attempts - 1) await sleep(delayMs);
    }

    throw new PublishError("temporary", `Container ${creationId} continua IN_PROGRESS apos ${attempts} verificacoes.`);
  }
}

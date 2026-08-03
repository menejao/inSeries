import { describe, expect, it, vi } from "vitest";
import { InstagramGraphClient } from "./graph-client";
import { InstagramGraphPublisher, parseMediaRef, assertValidRequest, CAPTION_MAX_LENGTH } from "./instagram-publisher";
import {
  HostedPublicationMediaResolver,
  NotConfiguredPublicationMediaResolver,
  type MediaReference,
  type PublicationMediaResolver,
  type RenderedSlide
} from "./image-hosting";
import { PublishError } from "./errors";
import { MediaHostingError, type HostedMedia, type ImageHostingService, type MediaAsset } from "../../media-hosting";
import type { MetaConfig } from "../../config";
import type { SocialPublication } from "@prisma/client";

/** Tudo mockado: nenhuma chamada real a Graph API, nenhum token real. */

const config: MetaConfig = {
  instagramBusinessAccountId: "17841400000000000",
  facebookPageId: null,
  appId: "app",
  appSecret: "secret",
  accessToken: "token-fake",
  apiVersion: "v21.0",
  requestTimeoutMs: 100,
  retryLimit: 3,
  publicMediaBaseUrl: "https://cdn.example.com/social"
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

/** Fake Graph API: replies per endpoint and records the sequence of calls made. */
function fakeGraph(overrides: { failOn?: string; error?: unknown } = {}) {
  const calls: string[] = [];
  let containerSeq = 0;

  const fetchImpl = async (url: string, init?: RequestInit): Promise<Response> => {
    const body = String(init?.body ?? "");
    let endpoint = "unknown";
    if (url.includes("/media_publish")) endpoint = "media_publish";
    else if (url.includes("/media")) endpoint = body.includes("is_carousel_item") ? "child" : body.includes("CAROUSEL") ? "parent" : body.includes("STORIES") ? "story" : "feed";
    else endpoint = "status";

    calls.push(endpoint);

    if (overrides.failOn === endpoint) {
      if (overrides.error instanceof Response) return overrides.error;
      throw overrides.error ?? new Error("boom");
    }

    if (endpoint === "status") return json({ status_code: "FINISHED" });
    if (endpoint === "media_publish") return json({ id: "ig-media-id" });
    containerSeq += 1;
    return json({ id: `container-${containerSeq}` });
  };

  return { calls, fetchImpl };
}

/**
 * INSERIES-SOCIAL-PUBLIC-MEDIA-STORAGE-07 — resolver de teste: devolve URLs publicas fixas sem
 * renderizar nada e sem storage real. As URLs sao o que o Publisher DEVE mandar para a Graph API.
 */
function staticResolver(urls: string[] = ["https://blob.example.com/social-media/pub-1/feed/00-a-b.png"]): PublicationMediaResolver {
  return {
    isConfigured: () => true,
    resolvePublicUrls: async (reference: MediaReference) =>
      reference.kind === "carousel" ? urls.slice(0, Math.max(reference.slideCount ?? urls.length, 2)) : [urls[0]]
  };
}

function publisherWith(fetchImpl: (url: string, init?: RequestInit) => Promise<Response>, slideCount?: number) {
  return new InstagramGraphPublisher({
    client: new InstagramGraphClient({ config, fetchImpl }),
    mediaResolver: staticResolver([
      "https://blob.example.com/social-media/pub-1/feed/00-a-b.png",
      "https://blob.example.com/social-media/pub-1/carousel/01-a-b.png",
      "https://blob.example.com/social-media/pub-1/carousel/02-a-b.png",
      "https://blob.example.com/social-media/pub-1/carousel/03-a-b.png"
    ]),
    sleep: async () => undefined,
    containerPollAttempts: slideCount ?? 3
  });
}

/** Um `ImageHostingService` totalmente falso — nenhum byte sai da maquina. */
function fakeHosting(overrides: Partial<ImageHostingService> = {}): ImageHostingService {
  return {
    provider: "fake",
    isConfigured: () => true,
    upload: async (asset: MediaAsset) => hostedFor(asset),
    uploadAll: async (assets: MediaAsset[]) => assets.map(hostedFor),
    remove: async () => true,
    list: async () => [],
    health: async () => {
      throw new Error("nao usado");
    },
    ...overrides
  } as ImageHostingService;
}

function hostedFor(asset: MediaAsset): HostedMedia {
  const id = `social-media/${asset.publicationId}/${asset.format}/${String(asset.slideIndex).padStart(2, "0")}.png`;
  return {
    id,
    publicUrl: `https://blob.example.com/${id}`,
    contentType: "image/png",
    size: 10,
    checksum: "c".repeat(64),
    createdAt: new Date(),
    expiresAt: new Date(),
    provider: "fake",
    reused: false
  };
}

/** Renderizador de teste: nunca abre Chromium, nunca toca o banco. */
function fakeRenderer(slideCount: number): (reference: MediaReference) => Promise<RenderedSlide[]> {
  return async (reference: MediaReference) =>
    Array.from({ length: reference.kind === "carousel" ? slideCount : 1 }, () => ({
      buffer: Buffer.from("png"),
      contentVersion: "v1"
    }));
}

function publicationRow(overrides: Partial<SocialPublication> = {}): SocialPublication {
  const base = {
    id: "pub-1",
    contentId: "content-1",
    network: "INSTAGRAM",
    caption: "legenda de teste",
    mediaRef: "placeholder://pub-1#feed",
    scheduledFor: new Date("2026-01-01T12:00:00.000Z"),
    status: "PENDING",
    publishedAt: null,
    externalId: null,
    createdAt: new Date(),
    updatedAt: new Date()
  };
  return { ...base, ...overrides } as SocialPublication;
}

describe("parseMediaRef", () => {
  it("usa feed como padrao, inclusive para mediaRef nulo", () => {
    expect(parseMediaRef(null)).toEqual({ kind: "feed", slideCount: 1 });
    expect(parseMediaRef("placeholder://x")).toEqual({ kind: "feed", slideCount: 1 });
  });

  it("reconhece story e carrossel com contagem de slides", () => {
    expect(parseMediaRef("placeholder://x#story")).toEqual({ kind: "story", slideCount: 1 });
    expect(parseMediaRef("placeholder://x#carousel:4")).toEqual({ kind: "carousel", slideCount: 4 });
  });
});

describe("assertValidRequest", () => {
  it("exige URL https publica", () => {
    expect(() =>
      assertValidRequest({ publicationId: "p", kind: "feed", caption: "x", imageUrls: ["http://inseguro/a.png"] })
    ).toThrow(PublishError);
  });

  it("revalida o limite de 10 itens do carrossel na fronteira", () => {
    const imageUrls = Array.from({ length: 11 }, (_, i) => `https://cdn.example.com/${i}.png`);
    expect(() => assertValidRequest({ publicationId: "p", kind: "carousel", caption: "x", imageUrls })).toThrow(/de 2 a 10 itens/);
  });

  it("recusa legenda acima do limite do Instagram", () => {
    expect(() =>
      assertValidRequest({ publicationId: "p", kind: "feed", caption: "a".repeat(CAPTION_MAX_LENGTH + 1), imageUrls: ["https://cdn/a.png"] })
    ).toThrow(/limite do Instagram/);
  });
});

describe("InstagramGraphPublisher", () => {
  it("publica um feed: cria container, aguarda FINISHED e publica", async () => {
    const graph = fakeGraph();
    const publisher = publisherWith(graph.fetchImpl);

    const result = await publisher.publish(publicationRow());

    expect(result).toEqual({ externalId: "ig-media-id" });
    expect(graph.calls).toEqual(["feed", "status", "media_publish"]);
  });

  it("publica um story com media_type=STORIES", async () => {
    const graph = fakeGraph();
    const publisher = publisherWith(graph.fetchImpl);

    const result = await publisher.publish(publicationRow({ mediaRef: "placeholder://pub-1#story" }));

    expect(result.externalId).toBe("ig-media-id");
    expect(graph.calls[0]).toBe("story");
  });

  it("publica um carrossel: um container por slide, depois o pai, depois media_publish", async () => {
    const graph = fakeGraph();
    const publisher = publisherWith(graph.fetchImpl);

    const result = await publisher.publish(publicationRow({ mediaRef: "placeholder://pub-1#carousel:3" }));

    expect(result.externalId).toBe("ig-media-id");
    expect(graph.calls).toEqual(["child", "child", "child", "parent", "status", "media_publish"]);
  });

  it("emite os estagios na ordem esperada (para o publish-service mover o status)", async () => {
    const graph = fakeGraph();
    const stages: string[] = [];
    const publisher = new InstagramGraphPublisher({
      client: new InstagramGraphClient({ config, fetchImpl: graph.fetchImpl }),
      mediaResolver: staticResolver(),
      sleep: async () => undefined,
      onStage: (stage) => {
        stages.push(stage);
      }
    });

    await publisher.publish(publicationRow());

    expect(stages).toEqual(["media-resolved", "uploading", "uploaded", "publishing", "published"]);
  });

  it("falha com erro claro e nao-retentavel quando nao ha hospedagem publica de imagem", async () => {
    const graph = fakeGraph();
    const publisher = new InstagramGraphPublisher({
      client: new InstagramGraphClient({ config, fetchImpl: graph.fetchImpl }),
      mediaResolver: new NotConfiguredPublicationMediaResolver()
    });

    await expect(publisher.publish(publicationRow())).rejects.toMatchObject({ kind: "not-configured", retryable: false });
    expect(graph.calls).toEqual([]);
  });

  it("propaga erro de autenticacao sem tentar publicar o container", async () => {
    const graph = fakeGraph({ failOn: "feed", error: json({ error: { message: "bad token", code: 190 } }, 400) });
    const publisher = publisherWith(graph.fetchImpl);

    await expect(publisher.publish(publicationRow())).rejects.toMatchObject({ kind: "auth", retryable: false });
    expect(graph.calls).not.toContain("media_publish");
  });

  it("getContainerStatus consulta a Graph API sem publicar nada", async () => {
    const graph = fakeGraph();
    const publisher = publisherWith(graph.fetchImpl);

    await expect(publisher.getContainerStatus("container-1")).resolves.toMatchObject({ statusCode: "FINISHED" });
    expect(graph.calls).toEqual(["status"]);
  });

  it("nunca chama fetch global (garante que todo HTTP passa pelo graph-client injetado)", async () => {
    const globalFetch = vi.spyOn(globalThis, "fetch");
    const graph = fakeGraph();
    await publisherWith(graph.fetchImpl).publish(publicationRow());
    expect(globalFetch).not.toHaveBeenCalled();
    globalFetch.mockRestore();
  });
});

/**
 * INSERIES-SOCIAL-PUBLIC-MEDIA-STORAGE-07 — integracao Publisher <-> media-hosting.
 * Storage falso, Graph API falsa: nada e enviado para lugar nenhum.
 */
describe("HostedPublicationMediaResolver", () => {
  it("renderiza, envia e devolve a URL publica do storage", async () => {
    const resolver = new HostedPublicationMediaResolver({ hosting: fakeHosting(), renderSlides: fakeRenderer(1) });

    await expect(resolver.resolvePublicUrls({ publicationId: "pub-1", contentId: "c-1", mediaRef: null, kind: "feed" })).resolves.toEqual([
      "https://blob.example.com/social-media/pub-1/feed/00.png"
    ]);
  });

  it("numera os slides do carrossel em ordem", async () => {
    const resolver = new HostedPublicationMediaResolver({ hosting: fakeHosting(), renderSlides: fakeRenderer(3) });

    await expect(
      resolver.resolvePublicUrls({ publicationId: "pub-1", contentId: "c-1", mediaRef: null, kind: "carousel", slideCount: 3 })
    ).resolves.toEqual([
      "https://blob.example.com/social-media/pub-1/carousel/00.png",
      "https://blob.example.com/social-media/pub-1/carousel/01.png",
      "https://blob.example.com/social-media/pub-1/carousel/02.png"
    ]);
  });

  it("storage nao configurado falha antes de renderizar qualquer coisa", async () => {
    const renderSlides = vi.fn(fakeRenderer(1));
    const resolver = new HostedPublicationMediaResolver({ hosting: fakeHosting({ isConfigured: () => false }), renderSlides });

    await expect(resolver.resolvePublicUrls({ publicationId: "pub-1", contentId: "c-1", mediaRef: null, kind: "feed" })).rejects.toMatchObject({
      kind: "not-configured",
      retryable: false
    });
    expect(renderSlides).not.toHaveBeenCalled();
  });

  it("traduz falha de upload em erro retentavel (backoff igual ao de uma chamada Graph instavel)", async () => {
    const resolver = new HostedPublicationMediaResolver({
      hosting: fakeHosting({
        uploadAll: async () => {
          throw new MediaHostingError("upload-failed", "provider fora do ar");
        }
      }),
      renderSlides: fakeRenderer(1)
    });

    await expect(resolver.resolvePublicUrls({ publicationId: "pub-1", contentId: "c-1", mediaRef: null, kind: "feed" })).rejects.toMatchObject({
      kind: "temporary",
      retryable: true
    });
  });

  it("PNG invalido vira erro de validacao nao-retentavel", async () => {
    const resolver = new HostedPublicationMediaResolver({
      hosting: fakeHosting({
        uploadAll: async () => {
          throw new MediaHostingError("validation", "Assinatura de bytes invalida");
        }
      }),
      renderSlides: fakeRenderer(1)
    });

    await expect(resolver.resolvePublicUrls({ publicationId: "pub-1", contentId: "c-1", mediaRef: null, kind: "feed" })).rejects.toMatchObject({
      kind: "validation",
      retryable: false
    });
  });
});

describe("Publisher <-> media-hosting", () => {
  it("usa exatamente a publicUrl devolvida pelo storage ao montar a chamada da Graph API", async () => {
    const graph = fakeGraph();
    const bodies: string[] = [];
    const fetchImpl = async (url: string, init?: RequestInit) => {
      bodies.push(String(init?.body ?? ""));
      return graph.fetchImpl(url, init);
    };

    const publisher = new InstagramGraphPublisher({
      client: new InstagramGraphClient({ config, fetchImpl }),
      mediaResolver: new HostedPublicationMediaResolver({ hosting: fakeHosting(), renderSlides: fakeRenderer(1) }),
      sleep: async () => undefined
    });

    await publisher.publish(publicationRow());

    const expected = encodeURIComponent("https://blob.example.com/social-media/pub-1/feed/00.png");
    expect(bodies[0]).toContain(expected);
  });

  it("a Meta NUNCA e chamada quando o upload falha", async () => {
    const graph = fakeGraph();
    const fetchSpy = vi.fn(graph.fetchImpl);

    const publisher = new InstagramGraphPublisher({
      client: new InstagramGraphClient({ config, fetchImpl: fetchSpy }),
      mediaResolver: new HostedPublicationMediaResolver({
        hosting: fakeHosting({
          uploadAll: async () => {
            throw new MediaHostingError("upload-failed", "Falha ao enviar no Vercel Blob");
          }
        }),
        renderSlides: fakeRenderer(1)
      }),
      sleep: async () => undefined
    });

    await expect(publisher.publish(publicationRow())).rejects.toThrow(PublishError);
    expect(fetchSpy).toHaveBeenCalledTimes(0);
    expect(graph.calls).toEqual([]);
  });

  it("carrossel aborta inteiro se um slide falhar o upload — nenhum container e criado", async () => {
    const graph = fakeGraph();
    const fetchSpy = vi.fn(graph.fetchImpl);
    let uploaded = 0;

    const hosting = fakeHosting({
      uploadAll: async (assets: MediaAsset[]) => {
        // Espelha o contrato tudo-ou-nada do provider real: falhou no meio, rejeita o lote.
        const done: HostedMedia[] = [];
        for (const asset of assets) {
          if (asset.slideIndex === 1) throw new MediaHostingError("upload-failed", "slide 2 falhou");
          uploaded += 1;
          done.push(hostedFor(asset));
        }
        return done;
      }
    });

    const publisher = new InstagramGraphPublisher({
      client: new InstagramGraphClient({ config, fetchImpl: fetchSpy }),
      mediaResolver: new HostedPublicationMediaResolver({ hosting, renderSlides: fakeRenderer(3) }),
      sleep: async () => undefined
    });

    await expect(publisher.publish(publicationRow({ mediaRef: "placeholder://pub-1#carousel:3" }))).rejects.toMatchObject({
      kind: "temporary"
    });
    expect(uploaded).toBe(1);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(graph.calls).toEqual([]);
  });

  it("o resolver nao-configurado explica a lacuna e nomeia a variavel de ambiente correta", async () => {
    const resolver = new NotConfiguredPublicationMediaResolver();
    expect(resolver.isConfigured()).toBe(false);
    await expect(resolver.resolvePublicUrls()).rejects.toThrow(/BLOB_READ_WRITE_TOKEN/);
  });
});

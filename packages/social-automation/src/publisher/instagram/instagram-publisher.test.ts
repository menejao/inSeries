import { describe, expect, it, vi } from "vitest";
import { InstagramGraphClient } from "./graph-client";
import { InstagramGraphPublisher, parseMediaRef, assertValidRequest, CAPTION_MAX_LENGTH } from "./instagram-publisher";
import { ConfiguredImageHostingService, NotConfiguredImageHostingService } from "./image-hosting";
import { PublishError } from "./errors";
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

function publisherWith(fetchImpl: (url: string, init?: RequestInit) => Promise<Response>, slideCount?: number) {
  return new InstagramGraphPublisher({
    client: new InstagramGraphClient({ config, fetchImpl }),
    imageHosting: new ConfiguredImageHostingService(config.publicMediaBaseUrl as string),
    sleep: async () => undefined,
    containerPollAttempts: slideCount ?? 3
  });
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
      imageHosting: new ConfiguredImageHostingService(config.publicMediaBaseUrl as string),
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
      imageHosting: new NotConfiguredImageHostingService()
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

describe("ImageHostingService", () => {
  it("compoe URLs por slide para carrossel", async () => {
    const service = new ConfiguredImageHostingService("https://cdn.example.com/social/");
    await expect(service.resolvePublicUrls({ publicationId: "p1", mediaRef: null, kind: "carousel", slideCount: 2 })).resolves.toEqual([
      "https://cdn.example.com/social/p1/carousel-01.png",
      "https://cdn.example.com/social/p1/carousel-02.png"
    ]);
  });

  it("a implementacao nao-configurada explica a lacuna de infraestrutura", async () => {
    const service = new NotConfiguredImageHostingService();
    expect(service.isConfigured()).toBe(false);
    await expect(service.resolvePublicUrls()).rejects.toThrow(/SOCIAL_AUTOMATION_PUBLIC_MEDIA_BASE_URL/);
  });
});

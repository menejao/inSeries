import { describe, expect, it, vi } from "vitest";
import { InstagramGraphClient } from "./graph-client";
import { PublishError, classifyGraphError } from "./errors";
import type { MetaConfig } from "../../config";

/**
 * INSERIES-INSTAGRAM-PUBLISHER-05 — NENHUM teste deste arquivo (ou de qualquer outro do ticket)
 * fala com a Meta Graph API real: `fetchImpl` e sempre um duble e nenhuma credencial real e usada.
 */

const config: MetaConfig = {
  instagramBusinessAccountId: "17841400000000000",
  facebookPageId: "1234567890",
  appId: "app-id-fake",
  appSecret: "app-secret-fake",
  accessToken: "EAAtest-token-fake-value",
  apiVersion: "v21.0",
  requestTimeoutMs: 50,
  retryLimit: 3,
  publicMediaBaseUrl: "https://cdn.example.com/social"
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function clientWith(fetchImpl: (url: string, init?: RequestInit) => Promise<Response>) {
  return new InstagramGraphClient({ config, fetchImpl });
}

describe("InstagramGraphClient", () => {
  it("cria um container de feed com image_url e caption e devolve o creation_id", async () => {
    const calls: Array<{ url: string; body: string }> = [];
    const client = clientWith(async (url, init) => {
      calls.push({ url, body: String(init?.body ?? "") });
      return jsonResponse({ id: "creation-1" });
    });

    const id = await client.createImageContainer({ imageUrl: "https://cdn.example.com/a.png", caption: "ola" });

    expect(id).toBe("creation-1");
    expect(calls[0].url).toBe("https://graph.facebook.com/v21.0/17841400000000000/media");
    expect(calls[0].body).toContain("image_url=https%3A%2F%2Fcdn.example.com%2Fa.png");
    expect(calls[0].body).toContain("caption=ola");
  });

  it("envia o token no header Authorization e nunca na query string", async () => {
    let seenUrl = "";
    let seenAuth = "";
    const client = clientWith(async (url, init) => {
      seenUrl = url;
      seenAuth = String((init?.headers as Record<string, string>)?.Authorization ?? "");
      return jsonResponse({ id: "creation-1" });
    });

    await client.createImageContainer({ imageUrl: "https://cdn.example.com/a.png", caption: "x" });

    expect(seenUrl).not.toContain("access_token");
    expect(seenUrl).not.toContain(config.accessToken);
    expect(seenAuth).toBe(`Bearer ${config.accessToken}`);
  });

  it("cria um container de story com media_type=STORIES", async () => {
    let body = "";
    const client = clientWith(async (_url, init) => {
      body = String(init?.body ?? "");
      return jsonResponse({ id: "story-container" });
    });

    await client.createStoryContainer({ imageUrl: "https://cdn.example.com/s.png" });

    expect(body).toContain("media_type=STORIES");
  });

  it("cria o container pai do carrossel com media_type=CAROUSEL e children", async () => {
    let body = "";
    const client = clientWith(async (_url, init) => {
      body = String(init?.body ?? "");
      return jsonResponse({ id: "carousel-parent" });
    });

    await client.createCarouselContainer({ childIds: ["a", "b", "c"], caption: "legenda" });

    expect(body).toContain("media_type=CAROUSEL");
    expect(body).toContain("children=a%2Cb%2Cc");
  });

  it("recusa um carrossel com mais de 10 itens antes de gastar uma chamada de API", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ id: "nope" }));
    const client = clientWith(fetchImpl);

    await expect(client.createCarouselContainer({ childIds: Array.from({ length: 11 }, (_, i) => `c${i}`), caption: "x" })).rejects.toMatchObject({
      kind: "validation",
      retryable: false
    });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("recusa um carrossel com menos de 2 itens", async () => {
    const client = clientWith(async () => jsonResponse({ id: "nope" }));
    await expect(client.createCarouselContainer({ childIds: ["only"], caption: "x" })).rejects.toBeInstanceOf(PublishError);
  });

  it("media_publish devolve o id real do Instagram", async () => {
    let url = "";
    const client = clientWith(async (calledUrl) => {
      url = calledUrl;
      return jsonResponse({ id: "17900000000000000" });
    });

    await expect(client.publishContainer("creation-1")).resolves.toBe("17900000000000000");
    expect(url).toContain("/media_publish");
  });

  it("consulta status do container e normaliza status_code", async () => {
    const client = clientWith(async (url) => {
      expect(url).toContain("fields=status_code");
      return jsonResponse({ status_code: "FINISHED" });
    });

    await expect(client.getContainerStatus("creation-1")).resolves.toMatchObject({ statusCode: "FINISHED" });
  });

  it("traduz erro de token invalido (code 190) em erro de auth nao-retentavel", async () => {
    const client = clientWith(async () => jsonResponse({ error: { message: "Invalid OAuth access token", code: 190 } }, 400));

    await expect(client.publishContainer("creation-1")).rejects.toMatchObject({ kind: "auth", retryable: false, graphCode: 190 });
  });

  it("traduz 429 em rate-limit retentavel", async () => {
    const client = clientWith(async () => jsonResponse({ error: { message: "limit", code: 4 } }, 429));

    await expect(client.publishContainer("creation-1")).rejects.toMatchObject({ kind: "rate-limit", retryable: true });
  });

  it("traduz 500 em erro temporario retentavel", async () => {
    const client = clientWith(async () => jsonResponse({}, 503));

    await expect(client.publishContainer("creation-1")).rejects.toMatchObject({ kind: "temporary", retryable: true });
  });

  it("traduz um abort do AbortController em timeout retentavel", async () => {
    const client = clientWith(async () => {
      const error = new Error("The operation was aborted");
      error.name = "AbortError";
      throw error;
    });

    await expect(client.publishContainer("creation-1")).rejects.toMatchObject({ kind: "timeout", retryable: true });
  });

  it("mascara o token quando ele aparece numa mensagem de erro da API", async () => {
    const client = clientWith(async () =>
      jsonResponse({ error: { message: `token ${config.accessToken} rejeitado`, code: 190 } }, 400)
    );

    const error = await client.publishContainer("c1").catch((caught: unknown) => caught as PublishError);

    expect(error).toBeInstanceOf(PublishError);
    expect((error as PublishError).message).not.toContain(config.accessToken as string);
    expect((error as PublishError).message).toContain("[redacted]");
  });

  it("waitForContainer aguarda IN_PROGRESS ate FINISHED", async () => {
    const statuses = ["IN_PROGRESS", "IN_PROGRESS", "FINISHED"];
    let index = 0;
    const client = clientWith(async () => jsonResponse({ status_code: statuses[index++] }));

    const sleep = vi.fn(async () => undefined);
    await expect(client.waitForContainer("c1", { attempts: 5, delayMs: 1, sleep })).resolves.toMatchObject({ statusCode: "FINISHED" });
    expect(sleep).toHaveBeenCalledTimes(2);
  });

  it("waitForContainer trata ERROR como midia invalida (sem retry)", async () => {
    const client = clientWith(async () => jsonResponse({ status_code: "ERROR" }));

    await expect(client.waitForContainer("c1", { attempts: 2, delayMs: 1, sleep: async () => undefined })).rejects.toMatchObject({
      kind: "invalid-media",
      retryable: false
    });
  });

  it("falha claramente quando o business account id nao esta configurado", async () => {
    const client = new InstagramGraphClient({
      config: { ...config, instagramBusinessAccountId: null },
      fetchImpl: async () => jsonResponse({})
    });

    await expect(client.createImageContainer({ imageUrl: "https://x/a.png", caption: "" })).rejects.toMatchObject({ kind: "not-configured" });
  });
});

describe("classifyGraphError", () => {
  it("mapeia os codigos que o ticket exige nunca serem retentados", () => {
    expect(classifyGraphError(190, null, 400)).toBe("auth");
    expect(classifyGraphError(10, null, 403)).toBe("permission");
    expect(classifyGraphError(200, null, 403)).toBe("permission");
    expect(classifyGraphError(100, null, 400)).toBe("invalid-media");
  });

  it("mapeia limites e falhas transitorias como retentaveis", () => {
    expect(classifyGraphError(4, null, 400)).toBe("rate-limit");
    expect(classifyGraphError(32, null, 400)).toBe("rate-limit");
    expect(classifyGraphError(null, null, 500)).toBe("temporary");
    expect(classifyGraphError(2, null, 400)).toBe("temporary");
  });
});

/**
 * INSERIES-SOCIAL-PUBLIC-MEDIA-STORAGE-07 — media hosting, end to end, with ZERO network.
 *
 * `@vercel/blob` is mocked at the module level: no real Blob Store is ever touched, no real token
 * exists in this environment, and nothing here can publish anything anywhere. Every service under
 * test takes its config by injection, so `process.env` is never mutated either.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@vercel/blob", () => ({
  put: vi.fn(),
  head: vi.fn(),
  del: vi.fn(),
  list: vi.fn()
}));

import { del, head, list, put } from "@vercel/blob";
import type { MediaStorageConfig } from "../config";
import { cleanupExpiredMedia, isExpired } from "./cleanup";
import { getImageHostingService, resetImageHostingService } from "./factory";
import { buildMediaKey, isInsidePrefix, publicationIdFromKey } from "./key";
import { NotConfiguredImageHostingService } from "./not-configured-provider";
import { MediaHostingError, type CleanupCandidate, type ImageHostingService, type MediaAsset } from "./types";
import { computeChecksum, hasPngSignature, PNG_SIGNATURE, validateAsset } from "./validation";
import { VercelBlobImageHostingService } from "./vercel-blob-provider";

const putMock = vi.mocked(put);
const headMock = vi.mocked(head);
const delMock = vi.mocked(del);
const listMock = vi.mocked(list);

/** A token SHAPED like a real one (`vercel_blob_rw_…`) but worthless — it is the leak canary. */
const TOKEN = "vercel_blob_rw_TESTSTORE_naoUseIssoEmLugarNenhum123456";

function config(overrides: Partial<MediaStorageConfig> = {}): MediaStorageConfig {
  return {
    provider: "vercel-blob",
    providerWarning: null,
    prefix: "social-media/",
    retentionHours: 72,
    maxBytes: 8 * 1024 * 1024,
    token: TOKEN,
    ...overrides
  } as MediaStorageConfig;
}

/**
 * A byte-accurate PNG header (signature + IHDR) plus optional filler. `validateAsset` reads only
 * these first 24 bytes, so this is a real PNG as far as every check in this module is concerned —
 * and it needs no Chromium, no fixture file and no Template Engine.
 */
function pngBuffer(options: { width?: number; height?: number; filler?: number } = {}): Buffer {
  const header = Buffer.alloc(24);
  PNG_SIGNATURE.copy(header, 0);
  header.writeUInt32BE(13, 8);
  header.write("IHDR", 12, "ascii");
  header.writeUInt32BE(options.width ?? 1080, 16);
  header.writeUInt32BE(options.height ?? 1080, 20);
  const filler = options.filler ?? 0;
  return filler > 0 ? Buffer.concat([header, Buffer.alloc(filler, 0x5a)]) : header;
}

function asset(overrides: Partial<MediaAsset> = {}): MediaAsset {
  return {
    publicationId: "pub-1",
    format: "feed",
    slideIndex: 0,
    contentVersion: "2026-01-01T00:00:00.000Z",
    buffer: pngBuffer(),
    ...overrides
  };
}

/** Captures every console line the package logger writes, so secrets can be asserted absent. */
function captureLogs() {
  const lines: string[] = [];
  const record = (...args: unknown[]) => {
    lines.push(args.map(String).join(" "));
  };
  const spies = [
    vi.spyOn(console, "log").mockImplementation(record),
    vi.spyOn(console, "warn").mockImplementation(record),
    vi.spyOn(console, "error").mockImplementation(record)
  ];
  return {
    lines,
    restore: () => spies.forEach((spy) => spy.mockRestore())
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  resetImageHostingService();
  headMock.mockResolvedValue(null as never);
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
describe("factory", () => {
  it("sem token devolve NotConfiguredImageHostingService", () => {
    const service = getImageHostingService(config({ token: null }));
    expect(service).toBeInstanceOf(NotConfiguredImageHostingService);
    expect(service.isConfigured()).toBe(false);
  });

  it("provider nao suportado tambem cai em nao-configurado (nunca 'assume que da certo')", () => {
    const service = getImageHostingService(config({ provider: null, providerWarning: 'provider "s3" nao suportado' }));
    expect(service).toBeInstanceOf(NotConfiguredImageHostingService);
  });

  it("com token e provider valido devolve o provider real do Vercel Blob", () => {
    const service = getImageHostingService(config());
    expect(service).toBeInstanceOf(VercelBlobImageHostingService);
    expect(service.provider).toBe("vercel-blob");
    expect(service.isConfigured()).toBe(true);
  });

  it("upload sem storage configurado falha de forma clara e nao-retentavel, sem tocar a rede", async () => {
    const service = getImageHostingService(config({ token: null }));
    await expect(service.upload(asset())).rejects.toMatchObject({ kind: "not-configured", retryable: false });
    await expect(service.upload(asset())).rejects.toThrow(/BLOB_READ_WRITE_TOKEN/);
    expect(putMock).not.toHaveBeenCalled();
  });

  it("remove/list de um storage inexistente sao no-ops seguros (cleanup nunca quebra)", async () => {
    const service = getImageHostingService(config({ token: null }));
    await expect(service.remove("social-media/x.png")).resolves.toBe(false);
    await expect(service.list()).resolves.toEqual([]);
    await expect(service.health()).resolves.toMatchObject({ configured: false, reachable: false, writeTested: false });
  });
});

// ---------------------------------------------------------------------------
describe("validacao de bytes", () => {
  it("aceita um PNG valido e devolve checksum/tamanho/dimensoes", () => {
    const buffer = pngBuffer({ filler: 100 });
    const result = validateAsset(asset({ buffer }), config());
    expect(result.checksum).toBe(computeChecksum(buffer));
    expect(result.size).toBe(buffer.length);
    expect(result.dimensions).toEqual({ width: 1080, height: 1080 });
    expect(result.contentType).toBe("image/png");
  });

  it("recusa arquivo vazio", () => {
    expect(() => validateAsset(asset({ buffer: Buffer.alloc(0) }), config())).toThrow(/vazio \(0 bytes\)/);
  });

  it("recusa contentType diferente de image/png", () => {
    expect(() => validateAsset(asset({ contentType: "image/jpeg" }), config())).toThrow(/nao e suportado/);
  });

  it("recusa bytes que nao sao PNG mesmo com contentType 'image/png' mentindo", () => {
    const jpeg = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(40, 1)]);
    expect(hasPngSignature(jpeg)).toBe(false);
    expect(() => validateAsset(asset({ buffer: jpeg, contentType: "image/png" }), config())).toThrow(/Assinatura de bytes invalida/);
  });

  it("recusa arquivo acima do limite configurado", () => {
    const big = pngBuffer({ filler: 500 });
    expect(() => validateAsset(asset({ buffer: big }), config({ maxBytes: 100 }))).toThrow(/excede o limite de 100 bytes/);
  });

  it("recusa dimensoes que nao batem com o formato", () => {
    expect(() => validateAsset(asset({ buffer: pngBuffer({ width: 500, height: 500 }) }), config())).toThrow(/nao batem com o formato "feed"/);
    expect(() => validateAsset(asset({ format: "story", buffer: pngBuffer() }), config())).toThrow(/esperado 1080x1920/);
  });
});

// ---------------------------------------------------------------------------
describe("chave deterministica", () => {
  const cfg = config();

  it("e estavel para o mesmo conteudo e muda quando o checksum muda", () => {
    const base = { publicationId: "pub-1", format: "feed" as const, slideIndex: 0, contentVersion: "v1" };
    const a = buildMediaKey({ ...base, checksum: "a".repeat(64) }, cfg);
    const b = buildMediaKey({ ...base, checksum: "a".repeat(64) }, cfg);
    const c = buildMediaKey({ ...base, checksum: "b".repeat(64) }, cfg);
    expect(a).toBe(b);
    expect(c).not.toBe(a);
  });

  it("sempre fica dentro do prefixo configurado e nunca escapa com '..'", () => {
    const key = buildMediaKey({ publicationId: "../../etc", format: "feed", slideIndex: 0, contentVersion: "v", checksum: "0".repeat(64) }, cfg);
    expect(key.startsWith("social-media/")).toBe(true);
    expect(key).not.toContain("..");
    expect(isInsidePrefix(key, cfg)).toBe(true);
    expect(isInsidePrefix("outro-bucket/x.png", cfg)).toBe(false);
    expect(isInsidePrefix("social-media/../secreto.png", cfg)).toBe(false);
  });

  it("permite atribuir um objeto de volta a sua publicacao", () => {
    const key = buildMediaKey({ publicationId: "pub-42", format: "carousel", slideIndex: 2, contentVersion: "v", checksum: "f".repeat(64) }, cfg);
    expect(publicationIdFromKey(key, cfg)).toBe("pub-42");
    expect(publicationIdFromKey("outro/x.png", cfg)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
describe("VercelBlobImageHostingService", () => {
  function service(overrides: Partial<MediaStorageConfig> = {}) {
    return new VercelBlobImageHostingService(config(overrides));
  }

  it("envia um PNG valido e devolve a URL publica com o formato esperado", async () => {
    const buffer = pngBuffer({ filler: 40 });
    const expectedKey = buildMediaKey(
      { publicationId: "pub-1", format: "feed", slideIndex: 0, contentVersion: "2026-01-01T00:00:00.000Z", checksum: computeChecksum(buffer) },
      config()
    );
    putMock.mockResolvedValue({ url: `https://store.public.blob.vercel-storage.com/${expectedKey}`, pathname: expectedKey } as never);

    const hosted = await service().upload(asset({ buffer }));

    expect(putMock).toHaveBeenCalledTimes(1);
    expect(putMock).toHaveBeenCalledWith(
      expectedKey,
      buffer,
      expect.objectContaining({ access: "public", contentType: "image/png", addRandomSuffix: false, token: TOKEN })
    );
    expect(hosted.id).toMatch(/^social-media\/pub-1\/feed\/00-[0-9a-f]{12}-[0-9a-f]{32}\.png$/);
    expect(hosted.publicUrl).toMatch(/^https:\/\/.+\/social-media\/pub-1\/feed\/.+\.png$/);
    expect(hosted).toMatchObject({ contentType: "image/png", size: buffer.length, provider: "vercel-blob", reused: false });
    expect(hosted.expiresAt.getTime() - hosted.createdAt.getTime()).toBe(72 * 3_600_000);
  });

  it("nada invalido chega na rede: put nunca e chamado para bytes recusados", async () => {
    await expect(service().upload(asset({ buffer: Buffer.alloc(0) }))).rejects.toThrow(MediaHostingError);
    await expect(service().upload(asset({ contentType: "image/webp" }))).rejects.toThrow(MediaHostingError);
    await expect(service().upload(asset({ buffer: Buffer.alloc(40, 3) }))).rejects.toThrow(/Assinatura de bytes invalida/);
    expect(putMock).not.toHaveBeenCalled();
  });

  it("e idempotente: um objeto identico ja online nao e reenviado", async () => {
    const buffer = pngBuffer({ filler: 12 });
    headMock.mockResolvedValue({
      url: "https://store.public.blob.vercel-storage.com/social-media/pub-1/feed/ja-existe.png",
      size: buffer.length,
      uploadedAt: new Date("2026-02-01T00:00:00.000Z")
    } as never);

    const hosted = await service().upload(asset({ buffer }));

    expect(hosted.reused).toBe(true);
    expect(putMock).not.toHaveBeenCalled();
    expect(headMock).toHaveBeenCalledTimes(1);
  });

  it("retry de uma publicacao inalterada reutiliza o asset ja enviado (put uma unica vez)", async () => {
    const buffer = pngBuffer({ filler: 8 });
    const svc = service();
    let stored: { url: string; size: number; uploadedAt: Date } | null = null;

    headMock.mockImplementation(async () => stored as never);
    putMock.mockImplementation(async (pathname: unknown) => {
      stored = { url: `https://store.public.blob.vercel-storage.com/${String(pathname)}`, size: buffer.length, uploadedAt: new Date() };
      return { url: stored.url, pathname: String(pathname) } as never;
    });

    const first = await svc.upload(asset({ buffer }));
    const second = await svc.upload(asset({ buffer }));

    expect(putMock).toHaveBeenCalledTimes(1);
    expect(first.reused).toBe(false);
    expect(second.reused).toBe(true);
    expect(second.id).toBe(first.id);
    expect(second.publicUrl).toBe(first.publicUrl);
  });

  it("conteudo alterado gera chave e asset novos (checksum diferente)", async () => {
    putMock.mockImplementation(async (pathname: unknown) => ({ url: `https://store/${String(pathname)}`, pathname: String(pathname) }) as never);
    const svc = service();

    const first = await svc.upload(asset({ buffer: pngBuffer({ filler: 10 }) }));
    const second = await svc.upload(asset({ buffer: pngBuffer({ filler: 11 }) }));

    expect(second.id).not.toBe(first.id);
    expect(second.checksum).not.toBe(first.checksum);
    expect(putMock).toHaveBeenCalledTimes(2);
  });

  it("uploadAll e tudo-ou-nada e preserva a ordem dos slides", async () => {
    putMock.mockImplementation(async (pathname: unknown) => ({ url: `https://store/${String(pathname)}`, pathname: String(pathname) }) as never);
    const slides = [0, 1, 2].map((slideIndex) =>
      asset({ format: "carousel", slideIndex, buffer: pngBuffer({ filler: 20 + slideIndex }) })
    );

    const hosted = await service().uploadAll(slides);

    expect(hosted).toHaveLength(3);
    expect(hosted.map((item) => item.id)).toEqual([
      expect.stringContaining("/carousel/00-"),
      expect.stringContaining("/carousel/01-"),
      expect.stringContaining("/carousel/02-")
    ]);
  });

  it("uploadAll aborta o lote inteiro quando um slide falha", async () => {
    let calls = 0;
    putMock.mockImplementation(async (pathname: unknown) => {
      calls += 1;
      if (calls === 2) throw new Error("blob indisponivel");
      return { url: `https://store/${String(pathname)}`, pathname: String(pathname) } as never;
    });
    const slides = [0, 1, 2].map((slideIndex) => asset({ format: "carousel", slideIndex, buffer: pngBuffer({ filler: 30 + slideIndex }) }));

    await expect(service().uploadAll(slides)).rejects.toMatchObject({ kind: "upload-failed", retryable: true });
    // O terceiro slide nunca chega a ser enviado.
    expect(putMock).toHaveBeenCalledTimes(2);
  });

  it("exclusao e idempotente: remover duas vezes nao lanca erro", async () => {
    const pathname = "social-media/pub-1/feed/00-abc-def.png";
    headMock
      .mockResolvedValueOnce({ url: `https://store/${pathname}`, size: 10, uploadedAt: new Date() } as never)
      .mockResolvedValue(null as never);
    delMock.mockResolvedValue(undefined as never);

    const svc = service();
    await expect(svc.remove(pathname)).resolves.toBe(true);
    await expect(svc.remove(pathname)).resolves.toBe(false);
    expect(delMock).toHaveBeenCalledTimes(1);
  });

  it("recusa remover qualquer coisa fora do prefixo configurado", async () => {
    await expect(service().remove("outro-bucket/importante.png")).rejects.toThrow(/fora do prefixo/);
    await expect(service().remove("https://store/outro-bucket/importante.png")).rejects.toThrow(/fora do prefixo/);
    expect(delMock).not.toHaveBeenCalled();
  });

  it("list nunca devolve objetos fora do prefixo, mesmo se o provider os retornar", async () => {
    listMock.mockResolvedValue({
      blobs: [
        { pathname: "social-media/pub-1/feed/a.png", url: "https://store/a.png", uploadedAt: new Date(), size: 10 },
        { pathname: "outro-bucket/segredo.png", url: "https://store/segredo.png", uploadedAt: new Date(), size: 10 }
      ],
      hasMore: false,
      cursor: undefined
    } as never);

    const found = await service().list();

    expect(found.map((item) => item.pathname)).toEqual(["social-media/pub-1/feed/a.png"]);
    expect(listMock).toHaveBeenCalledWith(expect.objectContaining({ prefix: "social-media/" }));
  });

  it("um prefixo pedido pelo caller so pode ESTREITAR o escopo, nunca alarga-lo", async () => {
    listMock.mockResolvedValue({ blobs: [], hasMore: false, cursor: undefined } as never);
    await service().list("outro-bucket/");
    expect(listMock).toHaveBeenCalledWith(expect.objectContaining({ prefix: "social-media/" }));
  });

  it("health e nao-destrutivo por padrao e so escreve quando pedido explicitamente", async () => {
    listMock.mockResolvedValue({ blobs: [], hasMore: false, cursor: undefined } as never);
    const svc = service();

    const readOnly = await svc.health();
    expect(readOnly).toMatchObject({ configured: true, reachable: true, objectCount: 0, writeTested: false, error: null });
    expect(putMock).not.toHaveBeenCalled();
    expect(delMock).not.toHaveBeenCalled();

    putMock.mockResolvedValue({ url: "https://store/health.png", pathname: "social-media/_health/x.png" } as never);
    delMock.mockResolvedValue(undefined as never);
    const write = await svc.health({ write: true });
    expect(write.writeTested).toBe(true);
    expect(putMock).toHaveBeenCalledTimes(1);
    expect(delMock).toHaveBeenCalledTimes(1);
  });

  it("health reporta inalcancavel (sem lancar) quando o provider recusa as credenciais", async () => {
    listMock.mockRejectedValue(new Error(`unauthorized for token ${TOKEN}`));
    const result = await service().health();
    expect(result).toMatchObject({ configured: true, reachable: false });
    expect(result.error).not.toContain(TOKEN);
  });
});

// ---------------------------------------------------------------------------
describe("segredo nunca vaza", () => {
  it("o token do Blob nao aparece em nenhuma mensagem de erro nem em nenhuma linha de log", async () => {
    const logs = captureLogs();
    const svc = new VercelBlobImageHostingService(config());

    // O @vercel/blob eco a o token dentro de algumas falhas — e exatamente esse o caso testado.
    putMock.mockRejectedValue(new Error(`PUT rejeitado (token=${TOKEN}) em https://api.vercel.com/blob?token=${TOKEN}`));
    listMock.mockRejectedValue(new Error(`LIST rejeitado com ${TOKEN}`));
    headMock.mockResolvedValue(null as never);

    // uploadAll tambem LOGA a falha (media-hosting:upload:lote-abortado), entao esta chamada cobre
    // de uma vez a mensagem lancada e a linha de log.
    const uploadError = await svc.uploadAll([asset({ buffer: pngBuffer({ filler: 5 }) })]).catch((error: unknown) => error);
    const listError = await svc.list().catch((error: unknown) => error);
    const health = await svc.health();

    logs.restore();

    for (const message of [
      (uploadError as Error).message,
      (listError as Error).message,
      String(health.error),
      JSON.stringify(health),
      logs.lines.join("\n")
    ]) {
      expect(message).not.toContain(TOKEN);
    }
    expect((uploadError as Error).message).toContain("[redacted]");
    expect(logs.lines.length).toBeGreaterThan(0);
  });

  it("nenhum objeto de log carrega a chave 'token' em claro", async () => {
    const logs = captureLogs();
    listMock.mockResolvedValue({ blobs: [], hasMore: false, cursor: undefined } as never);
    // Passa pelo caminho do factory, que loga a configuracao ativa.
    resetImageHostingService();
    getImageHostingService(config());
    logs.restore();

    expect(logs.lines.join("\n")).not.toContain(TOKEN);
    expect(logs.lines.join("\n")).toContain("media-hosting:configurado");
  });
});

// ---------------------------------------------------------------------------
describe("cleanup", () => {
  const cfg = config({ retentionHours: 24 });
  const now = new Date("2026-03-10T12:00:00.000Z");

  function candidate(pathname: string, hoursAgo: number): CleanupCandidate {
    return {
      pathname,
      publicUrl: `https://store/${pathname}`,
      uploadedAt: new Date(now.getTime() - hoursAgo * 3_600_000),
      size: 100
    };
  }

  function fakeService(candidates: CleanupCandidate[]): ImageHostingService & { removed: string[] } {
    const removed: string[] = [];
    return {
      removed,
      provider: "fake",
      isConfigured: () => true,
      upload: async () => {
        throw new Error("nao usado");
      },
      uploadAll: async () => {
        throw new Error("nao usado");
      },
      remove: async (target: string) => {
        removed.push(target);
        return true;
      },
      list: async () => candidates,
      health: async () => {
        throw new Error("nao usado");
      }
    } as ImageHostingService & { removed: string[] };
  }

  it("isExpired respeita exatamente a janela de retencao", () => {
    expect(isExpired(candidate("social-media/a.png", 23), now, 24)).toBe(false);
    expect(isExpired(candidate("social-media/a.png", 25), now, 24)).toBe(true);
  });

  it("nao remove nada mais novo que a retencao minima", async () => {
    const service = fakeService([candidate("social-media/pub-1/feed/novo.png", 2), candidate("social-media/pub-2/feed/velho.png", 48)]);

    const result = await cleanupExpiredMedia({ service, config: cfg, now, findInFlightPublicationIds: async () => [] });

    expect(result.scanned).toBe(2);
    expect(result.retained).toBe(1);
    expect(result.deleted).toEqual(["social-media/pub-2/feed/velho.png"]);
    expect(service.removed).toEqual(["social-media/pub-2/feed/velho.png"]);
  });

  it("nunca opera fora do prefixo configurado", async () => {
    const service = fakeService([candidate("outro-bucket/velho.png", 999), candidate("social-media/pub-1/feed/velho.png", 999)]);

    const result = await cleanupExpiredMedia({ service, config: cfg, now, findInFlightPublicationIds: async () => [] });

    expect(service.removed).toEqual(["social-media/pub-1/feed/velho.png"]);
    expect(result.deleted).not.toContain("outro-bucket/velho.png");
  });

  it("preserva assets de publicacoes ainda em voo, por mais velhos que sejam", async () => {
    const service = fakeService([candidate("social-media/pub-1/feed/velho.png", 999)]);

    const result = await cleanupExpiredMedia({ service, config: cfg, now, findInFlightPublicationIds: async () => ["pub-1"] });

    expect(result.deleted).toEqual([]);
    expect(result.skippedInFlight).toEqual(["social-media/pub-1/feed/velho.png"]);
    expect(service.removed).toEqual([]);
  });

  it("dryRun nao remove nada", async () => {
    const service = fakeService([candidate("social-media/pub-1/feed/velho.png", 999)]);

    const result = await cleanupExpiredMedia({ service, config: cfg, now, dryRun: true, findInFlightPublicationIds: async () => [] });

    expect(result.dryRun).toBe(true);
    expect(result.deleted).toHaveLength(1);
    expect(service.removed).toEqual([]);
  });

  it("e idempotente e sem storage configurado nao faz nada", async () => {
    const result = await cleanupExpiredMedia({
      service: new NotConfiguredImageHostingService(config({ token: null })),
      config: cfg,
      now,
      findInFlightPublicationIds: async () => []
    });
    expect(result).toMatchObject({ scanned: 0, deleted: [], failed: [] });
  });
});

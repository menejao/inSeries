import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * INSERIES-SOCIAL-TEMPLATE-ENGINE-04-FINALIZATION — problema 3 (lifecycle do Playwright).
 *
 * Playwright e mockado: os testes contam lancamentos de browser, contexts/pages abertos e fechados
 * e o comportamento da fila/cache. Nenhum Chromium real e iniciado aqui.
 */

const state = {
  launches: 0,
  contextsOpened: 0,
  contextsClosed: 0,
  pagesOpened: 0,
  browserClosed: 0,
  launchDelayMs: 0,
  screenshotDelayMs: 0,
  failSetContent: false,
  activePages: 0,
  maxActivePages: 0
};

function makePage() {
  state.pagesOpened += 1;
  state.activePages += 1;
  state.maxActivePages = Math.max(state.maxActivePages, state.activePages);
  return {
    async setContent() {
      if (state.failSetContent) throw new Error("setContent explodiu");
    },
    async screenshot() {
      if (state.screenshotDelayMs > 0) await new Promise((r) => setTimeout(r, state.screenshotDelayMs));
      return Buffer.from("png");
    }
  };
}

function makeBrowser() {
  const listeners = new Map<string, Array<(...args: unknown[]) => void>>();
  let connected = true;
  return {
    isConnected: () => connected,
    once(event: string, handler: (...args: unknown[]) => void) {
      listeners.set(event, [...(listeners.get(event) ?? []), handler]);
    },
    async newContext() {
      state.contextsOpened += 1;
      let pagesOfContext = 0;
      return {
        async newPage() {
          pagesOfContext += 1;
          return makePage();
        },
        async close() {
          state.contextsClosed += 1;
          state.activePages = Math.max(0, state.activePages - pagesOfContext);
        }
      };
    },
    async close() {
      state.browserClosed += 1;
      connected = false;
      for (const handler of listeners.get("disconnected") ?? []) handler();
    },
    process: () => ({ pid: 4242 })
  };
}

vi.mock("playwright", () => ({
  chromium: {
    async launch() {
      state.launches += 1;
      if (state.launchDelayMs > 0) await new Promise((r) => setTimeout(r, state.launchDelayMs));
      return makeBrowser();
    }
  }
}));

const doc = { html: "<html><body>oi</body></html>", viewport: { width: 100, height: 100 }, slideKey: "cta" };

let renderer: typeof import("./index");

beforeEach(async () => {
  Object.assign(state, {
    launches: 0,
    contextsOpened: 0,
    contextsClosed: 0,
    pagesOpened: 0,
    browserClosed: 0,
    launchDelayMs: 0,
    screenshotDelayMs: 0,
    failSetContent: false,
    activePages: 0,
    maxActivePages: 0
  });
  renderer = await import("./index");
  renderer.__resetRendererStateForTests();
});

afterEach(() => {
  renderer.__resetRendererStateForTests();
});

describe("lifecycle do browser", () => {
  it("duas chamadas concorrentes compartilham UM unico browser", async () => {
    state.launchDelayMs = 20;
    await Promise.all([renderer.render(doc), renderer.render(doc)]);
    expect(state.launches).toBe(1);
  });

  it("reusa o browser entre renders sequenciais", async () => {
    await renderer.render(doc);
    await renderer.render(doc);
    expect(state.launches).toBe(1);
    expect(renderer.getRendererMetrics().rendersCompleted).toBe(2);
  });

  it("fecha context e page em caso de sucesso", async () => {
    await renderer.render(doc);
    expect(state.contextsOpened).toBe(1);
    expect(state.contextsClosed).toBe(1);
    expect(state.activePages).toBe(0);
  });

  it("fecha context e page tambem quando o render falha", async () => {
    state.failSetContent = true;
    await expect(renderer.render(doc)).rejects.toThrow(/explodiu/);
    expect(state.contextsOpened).toBe(1);
    expect(state.contextsClosed).toBe(1);
    expect(state.activePages).toBe(0);
    expect(renderer.getRendererMetrics().rendersFailed).toBe(1);
  });

  it("rejeita documento invalido sem abrir browser", async () => {
    // @ts-expect-error — teste de contrato
    await expect(renderer.render({})).rejects.toThrow(/documento invalido/);
    expect(state.launches).toBe(0);
  });

  it("respeita o limite de concorrencia", async () => {
    state.screenshotDelayMs = 25;
    await Promise.all([renderer.render(doc), renderer.render(doc), renderer.render(doc), renderer.render(doc)]);
    expect(state.maxActivePages).toBeLessThanOrEqual(2);
    expect(state.launches).toBe(1);
  });

  it("estoura timeout com erro claro e nao vaza context", async () => {
    state.screenshotDelayMs = 60;
    await expect(renderer.render(doc, { renderTimeoutMs: 10 })).rejects.toThrow(/tempo limite/);
    expect(renderer.getRendererMetrics().timeouts).toBe(1);
    expect(state.contextsClosed).toBe(1);
  });

  it("closeRenderer e idempotente", async () => {
    await renderer.render(doc);
    await renderer.closeRenderer();
    await renderer.closeRenderer();
    await renderer.closeRenderer();
    expect(state.browserClosed).toBe(1);
  });

  it("relanca o browser depois de um close", async () => {
    await renderer.render(doc);
    await renderer.closeRenderer();
    await renderer.render(doc);
    expect(state.launches).toBe(2);
  });

  it("renderAll preserva a ordem e reusa o browser", async () => {
    const results = await renderer.renderAll([doc, doc, doc]);
    expect(results).toHaveLength(3);
    expect(state.launches).toBe(1);
  });
});

describe("cache de preview", () => {
  const cacheInput = { contentId: "c1", version: "v1", templateKey: "themed-list", format: "carousel", slideIndex: 3 };

  it("reutiliza o resultado dentro do TTL", async () => {
    await renderer.renderCached(doc, cacheInput);
    await renderer.renderCached(doc, cacheInput);
    expect(state.contextsOpened).toBe(1);
    expect(renderer.getRendererMetrics().cacheHits).toBe(1);
  });

  it("invalida quando a versao do conteudo muda", async () => {
    await renderer.renderCached(doc, cacheInput);
    await renderer.renderCached(doc, { ...cacheInput, version: "v2" });
    expect(state.contextsOpened).toBe(2);
  });

  it("chaves diferentes por formato/slide/tema", () => {
    const base = renderer.previewCacheKey(cacheInput);
    expect(base).not.toBe(renderer.previewCacheKey({ ...cacheInput, format: "feed" }));
    expect(base).not.toBe(renderer.previewCacheKey({ ...cacheInput, slideIndex: 4 }));
    expect(base).not.toBe(renderer.previewCacheKey({ ...cacheInput, themeKey: "dark" }));
  });

  it("expira apos o TTL", async () => {
    await renderer.renderCached(doc, cacheInput, {}, 1);
    await new Promise((r) => setTimeout(r, 5));
    await renderer.renderCached(doc, cacheInput, {}, 1);
    expect(state.contextsOpened).toBe(2);
  });
});

describe("cleanupRendererTempProfiles", () => {
  it("so remove diretorios com o prefixo exato do Playwright", async () => {
    const os = await import("node:os");
    const fs = await import("node:fs/promises");
    const path = await import("node:path");

    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "inseries-cleanup-test-"));
    const orphan = path.join(tmpDir, "playwright_chromiumdev_profile-abc123");
    const decoy = path.join(tmpDir, "important-user-data");
    const recent = path.join(tmpDir, "playwright_chromiumdev_profile-recent");
    await fs.mkdir(orphan);
    await fs.mkdir(decoy);
    await fs.mkdir(recent);
    // Envelhece so o orfao.
    const old = new Date(Date.now() - 60 * 60_000);
    await fs.utimes(orphan, old, old);

    const removed = await renderer.cleanupRendererTempProfiles({ tmpDir, minAgeMinutes: 10 });

    expect(removed).toEqual([orphan]);
    await expect(fs.stat(decoy)).resolves.toBeTruthy();
    await expect(fs.stat(recent)).resolves.toBeTruthy();
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("dryRun nao apaga nada", async () => {
    const os = await import("node:os");
    const fs = await import("node:fs/promises");
    const path = await import("node:path");
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "inseries-cleanup-dry-"));
    const orphan = path.join(tmpDir, "playwright_chromiumdev_profile-xyz");
    await fs.mkdir(orphan);
    const old = new Date(Date.now() - 60 * 60_000);
    await fs.utimes(orphan, old, old);

    const removed = await renderer.cleanupRendererTempProfiles({ tmpDir, minAgeMinutes: 10, dryRun: true });
    expect(removed).toEqual([orphan]);
    await expect(fs.stat(orphan)).resolves.toBeTruthy();
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("tolera um tmpDir inexistente", async () => {
    await expect(renderer.cleanupRendererTempProfiles({ tmpDir: "/definitivamente/nao/existe/xyz" })).resolves.toEqual([]);
  });
});

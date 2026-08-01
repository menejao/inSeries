/**
 * THE renderer. One function — `render()` — turns a RenderableDocument into a PNG buffer.
 *
 * Everything that produces an image goes through here: feed, carousel slides, story AND the admin
 * preview route. There is deliberately no second rendering path (no "preview renderer"), so what
 * an admin sees in the panel is byte-for-byte what the publisher would upload.
 *
 * Constraints honoured:
 *  - no network: the documents are fully self-contained (data-URI fonts, inline SVG, CSS
 *    gradients) and the page is loaded via `setContent` with `waitUntil: "load"`;
 *  - no AI, no video;
 *  - ONE Chromium instance per process, reused across calls.
 *
 * ---------------------------------------------------------------------------------------------
 * INSERIES-SOCIAL-TEMPLATE-ENGINE-04-FINALIZATION — lifecycle.
 *
 * The previous version kept `browserPromise` in a plain module-scope variable. Under the Next.js
 * dev server the module is re-evaluated on every HMR reload: the new module got a fresh `null`
 * reference while the Chromium started by the previous module copy stayed alive, orphaned, holding
 * a temp profile directory in os.tmpdir(). A single dev session produced 4 orphan profiles and ~33
 * chrome.exe processes.
 *
 * The state now lives on `globalThis` (dev only — in production there is no HMR, so a module-scope
 * value is enough and we avoid leaking anything onto the global object of a server process), plus:
 * shared init promise (no double launch), per-render context+page always closed in `finally`,
 * `disconnected` detection, a render timeout, a small concurrency limit, idempotent
 * `closeRenderer()`, process-exit handlers registered exactly once, in-memory metrics and an
 * opt-in temp-profile sweeper.
 */
import path from "node:path";
import os from "node:os";
import fs from "node:fs/promises";
import type { Browser, BrowserContext } from "playwright";
import { logger } from "../../logger";
import { TemplateEngineError, type RenderableDocument } from "../types";

export interface RenderOptions {
  /** 1 = exact viewport pixels. Kept configurable for a future @2x export; default 1. */
  deviceScaleFactor?: number;
  /** Milliseconds allowed for the page to settle before the screenshot. */
  timeoutMs?: number;
  /** Hard ceiling for the whole render (launch excluded). Default 30s. */
  renderTimeoutMs?: number;
}

export interface RenderResult {
  buffer: Buffer;
  width: number;
  height: number;
}

export interface RendererMetrics {
  browsersLaunched: number;
  rendersCompleted: number;
  rendersFailed: number;
  rendersActive: number;
  restarts: number;
  timeouts: number;
  queueDepth: number;
  cacheHits: number;
  cacheMisses: number;
}

const MODULE = "template-engine/renderer";
const DEFAULT_RENDER_TIMEOUT_MS = 30_000;
const DEFAULT_PAGE_TIMEOUT_MS = 15_000;
/** Small on purpose: this runs on a modest server and each Chromium page costs real memory. */
const MAX_CONCURRENT_RENDERS = 2;

const isProduction = process.env.NODE_ENV === "production";
const isDev = !isProduction;

function debug(message: string, metadata?: Record<string, unknown>) {
  // Lifecycle chatter is a dev diagnostic; production only ever sees warn/error from here.
  if (isDev) logger.debug(message, { module: MODULE, metadata });
}

/* ------------------------------------------------------------------ state */

interface RendererState {
  browser: Browser | null;
  initPromise: Promise<Browser> | null;
  active: number;
  queue: Array<() => void>;
  createdAt: number | null;
  pid: number | null;
  closing: boolean;
  handlersRegistered: boolean;
  metrics: RendererMetrics;
  cache: Map<string, { buffer: Buffer; width: number; height: number; expiresAt: number }>;
}

declare global {
  // eslint-disable-next-line no-var -- globalThis singleton must be a `var` to be augmentable.
  var __inseriesSocialRenderer: RendererState | undefined;
}

function freshState(): RendererState {
  return {
    browser: null,
    initPromise: null,
    active: 0,
    queue: [],
    createdAt: null,
    pid: null,
    closing: false,
    handlersRegistered: false,
    metrics: {
      browsersLaunched: 0,
      rendersCompleted: 0,
      rendersFailed: 0,
      rendersActive: 0,
      restarts: 0,
      timeouts: 0,
      queueDepth: 0,
      cacheHits: 0,
      cacheMisses: 0
    },
    cache: new Map()
  };
}

/**
 * In dev the state hangs off `globalThis` so it survives HMR module reloads (that is the whole
 * point of this rewrite). In production the module is evaluated once, so a module-local value is
 * both sufficient and cleaner.
 */
const moduleState: RendererState = freshState();

function getState(): RendererState {
  if (isProduction) return moduleState;
  if (!globalThis.__inseriesSocialRenderer) {
    globalThis.__inseriesSocialRenderer = moduleState;
  }
  return globalThis.__inseriesSocialRenderer;
}

/** In-memory counters only — nothing is persisted, nothing survives a restart. */
export function getRendererMetrics(): RendererMetrics {
  const state = getState();
  return { ...state.metrics, rendersActive: state.active, queueDepth: state.queue.length };
}

/** Testing/diagnostics helper: forgets everything without touching a live browser. */
export function __resetRendererStateForTests(): void {
  const state = getState();
  state.browser = null;
  state.initPromise = null;
  state.active = 0;
  state.queue = [];
  state.createdAt = null;
  state.pid = null;
  state.closing = false;
  state.cache.clear();
  state.metrics = freshState().metrics;
}

/* -------------------------------------------------------------- launching */

/** Lazily imported so that importing the template engine (types, registry, tests) never loads Playwright. */
async function launchBrowser(): Promise<Browser> {
  let chromium: typeof import("playwright").chromium;
  try {
    ({ chromium } = await import("playwright"));
  } catch (error) {
    throw new TemplateEngineError(
      `Playwright nao esta disponivel neste ambiente (${error instanceof Error ? error.message : String(error)}).`
    );
  }
  try {
    return await chromium.launch({ args: ["--font-render-hinting=none", "--disable-lcd-text"] });
  } catch (error) {
    throw new TemplateEngineError(
      `Nao foi possivel iniciar o Chromium — rode "npx playwright install chromium". Detalhe: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}

function browserPid(browser: Browser): number | null {
  // `process()` only exists on locally launched browsers and is not part of the public typings
  // of every Playwright version — read it defensively.
  const candidate = (browser as unknown as { process?: () => { pid?: number } | null }).process;
  if (typeof candidate !== "function") return null;
  try {
    return candidate.call(browser)?.pid ?? null;
  } catch {
    return null;
  }
}

async function getBrowser(): Promise<Browser> {
  const state = getState();
  if (state.closing) {
    throw new TemplateEngineError("renderer esta sendo encerrado — nenhum novo render foi aceito.");
  }
  if (state.browser?.isConnected()) {
    debug("browser reusado", { pid: state.pid, ageMs: state.createdAt ? Date.now() - state.createdAt : null });
    return state.browser;
  }
  if (state.initPromise) return state.initPromise;

  // A rejected promise must never stay cached, otherwise a transient launch failure would poison
  // every later call for the lifetime of the process.
  const promise = launchBrowser()
    .then((browser) => {
      state.browser = browser;
      state.initPromise = null;
      state.createdAt = Date.now();
      state.pid = browserPid(browser);
      state.metrics.browsersLaunched += 1;
      browser.once("disconnected", () => {
        // Chromium died (crash, external kill, closeRenderer). Drop the reference so the next
        // render relaunches instead of failing forever on a dead handle.
        if (state.browser === browser) {
          state.browser = null;
          state.initPromise = null;
          state.pid = null;
          state.createdAt = null;
          if (!state.closing) state.metrics.restarts += 1;
        }
        debug("browser desconectado", { pid: state.pid, closing: state.closing });
      });
      debug("browser iniciado", { pid: state.pid, launched: state.metrics.browsersLaunched });
      // Varredura conservadora de perfis orfaos de sessoes anteriores: so em dev, so no primeiro
      // launch do processo, so diretorios com >10min. Nunca em producao, nunca durante os testes.
      if (state.metrics.browsersLaunched === 1) scheduleDevTempProfileCleanup();
      return browser;
    })
    .catch((error) => {
      state.initPromise = null;
      state.browser = null;
      throw error;
    });

  state.initPromise = promise;
  return promise;
}

export async function rendererIsAvailable(): Promise<boolean> {
  try {
    await getBrowser();
    return true;
  } catch {
    return false;
  }
}

/* ------------------------------------------------------------ concurrency */

/** Tiny FIFO semaphore. No new dependency: an array of resolvers is all this needs. */
async function acquireSlot(): Promise<void> {
  const state = getState();
  if (state.active < MAX_CONCURRENT_RENDERS) {
    state.active += 1;
    return;
  }
  debug("render enfileirado", { active: state.active, queue: state.queue.length + 1 });
  await new Promise<void>((resolve) => state.queue.push(resolve));
  state.active += 1;
}

function releaseSlot(): void {
  const state = getState();
  state.active = Math.max(0, state.active - 1);
  const next = state.queue.shift();
  if (next) next();
}

/* ---------------------------------------------------------------- caching */

export interface PreviewCacheKeyInput {
  contentId: string;
  /** Content version — `updatedAt` of the SocialContent or a payload hash. Invalidation is implicit. */
  version: string | number | Date;
  templateKey: string;
  format: string;
  slideIndex?: number;
  themeKey?: string | null;
}

/** Default TTL kept short: a preview is cheap to regenerate and must reflect edits quickly. */
export const PREVIEW_CACHE_TTL_MS = 60_000;

export function previewCacheKey(input: PreviewCacheKeyInput): string {
  const version = input.version instanceof Date ? input.version.toISOString() : String(input.version);
  return [input.contentId, version, input.templateKey, input.format, input.slideIndex ?? 0, input.themeKey ?? "default"].join("|");
}

function pruneCache(now: number): void {
  const state = getState();
  for (const [key, entry] of state.cache) {
    if (entry.expiresAt <= now) state.cache.delete(key);
  }
}

/** Only the PNG bytes + dimensions are stored — never the payload, never anything sensitive. */
export function getCachedRender(key: string): RenderResult | null {
  const state = getState();
  const now = Date.now();
  pruneCache(now);
  const entry = state.cache.get(key);
  if (!entry) {
    state.metrics.cacheMisses += 1;
    return null;
  }
  state.metrics.cacheHits += 1;
  return { buffer: entry.buffer, width: entry.width, height: entry.height };
}

export function setCachedRender(key: string, result: RenderResult, ttlMs = PREVIEW_CACHE_TTL_MS): void {
  const state = getState();
  state.cache.set(key, { ...result, expiresAt: Date.now() + ttlMs });
}

export function clearRenderCache(): void {
  getState().cache.clear();
}

/**
 * Cache-aware wrapper around `render()`. Callers that have a stable content version (the admin
 * preview route) use this; the publisher path keeps calling `render()` directly.
 */
export async function renderCached(
  document: RenderableDocument,
  cacheInput: PreviewCacheKeyInput,
  options: RenderOptions = {},
  ttlMs = PREVIEW_CACHE_TTL_MS
): Promise<RenderResult> {
  const key = previewCacheKey(cacheInput);
  const hit = getCachedRender(key);
  if (hit) {
    debug("preview cache hit", { contentId: cacheInput.contentId, format: cacheInput.format });
    return hit;
  }
  const result = await render(document, options);
  setCachedRender(key, result, ttlMs);
  return result;
}

/* --------------------------------------------------------------- render */

function timeoutError(ms: number): TemplateEngineError {
  return new TemplateEngineError(`render(): tempo limite de ${ms}ms excedido — a arte nao pode ser gerada agora.`);
}

/** Renders one document to a PNG buffer. The single rendering entry point of the engine. */
export async function render(document: RenderableDocument, options: RenderOptions = {}): Promise<RenderResult> {
  if (!document?.html || !document.viewport) {
    throw new TemplateEngineError("render(): documento invalido — html/viewport ausentes.");
  }
  const state = getState();
  if (state.closing) {
    throw new TemplateEngineError("renderer esta sendo encerrado — nenhum novo render foi aceito.");
  }

  await acquireSlot();
  const renderTimeoutMs = options.renderTimeoutMs ?? DEFAULT_RENDER_TIMEOUT_MS;
  let context: BrowserContext | null = null;
  let timer: NodeJS.Timeout | null = null;

  try {
    const browser = await getBrowser();
    context = await browser.newContext({
      viewport: { width: document.viewport.width, height: document.viewport.height },
      deviceScaleFactor: options.deviceScaleFactor ?? 1,
      // Belt and braces: even if a template ever emitted a remote <img>, it would not be fetched.
      offline: true,
      javaScriptEnabled: false
    });
    debug("context criado", { slideKey: document.slideKey, active: state.active });

    const work = (async (): Promise<RenderResult> => {
      const page = await context!.newPage();
      await page.setContent(document.html, { waitUntil: "load", timeout: options.timeoutMs ?? DEFAULT_PAGE_TIMEOUT_MS });
      const buffer = await page.screenshot({ type: "png", clip: { x: 0, y: 0, ...document.viewport } });
      return { buffer, width: document.viewport.width, height: document.viewport.height };
    })();

    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(timeoutError(renderTimeoutMs)), renderTimeoutMs);
    });

    const result = await Promise.race([work, timeout]);
    // Swallow a late rejection from the losing promise so it never becomes an unhandled rejection.
    void work.catch(() => undefined);
    state.metrics.rendersCompleted += 1;
    debug("render concluido", { slideKey: document.slideKey, bytes: result.buffer.byteLength });
    return result;
  } catch (error) {
    state.metrics.rendersFailed += 1;
    const isTimeout = error instanceof TemplateEngineError && error.message.includes("tempo limite");
    if (isTimeout) state.metrics.timeouts += 1;
    logger.warn("render falhou", {
      module: MODULE,
      // Never the payload/html — only what is needed to locate the failure.
      metadata: { slideKey: document.slideKey, timeout: isTimeout, message: error instanceof Error ? error.message : String(error) }
    });
    // A timeout kills only this render's context; the browser is preserved when still healthy and
    // relaunched by the next call when it is not (the `disconnected` handler cleared it).
    if (isTimeout && state.browser && !state.browser.isConnected()) {
      state.browser = null;
      state.initPromise = null;
    }
    throw error;
  } finally {
    if (timer) clearTimeout(timer);
    if (context) {
      // Closing the context closes its pages: nothing leaks on success OR on error.
      await context.close().catch(() => undefined);
    }
    releaseSlot();
  }
}

/** Renders several documents sequentially (shared browser). Order is preserved. */
export async function renderAll(documents: RenderableDocument[], options: RenderOptions = {}): Promise<RenderResult[]> {
  const results: RenderResult[] = [];
  for (const doc of documents) {
    results.push(await render(doc, options));
  }
  return results;
}

/* ---------------------------------------------------------------- closing */

/** Closes the shared browser. Idempotent: calling it twice (or during a close) is a no-op. */
export async function closeRenderer(): Promise<void> {
  const state = getState();
  if (state.closing) return;
  state.closing = true;
  try {
    const pending = state.initPromise;
    const browser = state.browser ?? (pending ? await pending.catch(() => null) : null);
    state.browser = null;
    state.initPromise = null;
    state.cache.clear();
    if (browser) {
      await browser.close().catch(() => undefined);
      debug("browser fechado", { pid: state.pid });
    }
    state.pid = null;
    state.createdAt = null;
  } finally {
    state.closing = false;
    // Unblock anyone waiting in the queue; they will fail fast on a closed/absent browser.
    for (const resume of state.queue.splice(0)) resume();
  }
}

/**
 * Registered EXACTLY ONCE per process. The flag lives in the same globalThis state, so an HMR
 * reload re-evaluating this module does not stack a second copy of every listener.
 */
function registerExitHandlers(): void {
  const state = getState();
  if (state.handlersRegistered) return;
  state.handlersRegistered = true;

  const close = () => {
    void closeRenderer();
  };
  process.once("SIGINT", close);
  process.once("SIGTERM", close);
  process.once("beforeExit", close);
  process.once("uncaughtException", (error) => {
    logger.error("uncaughtException — fechando o renderer", {
      module: MODULE,
      metadata: { message: error instanceof Error ? error.message : String(error) }
    });
    close();
  });
}

registerExitHandlers();

/* ------------------------------------------------- temp profile cleanup */

/**
 * Playwright launches Chromium with a throwaway user-data-dir named
 * `playwright_chromiumdev_profile-XXXXXX` inside os.tmpdir(). It removes it on a clean close; an
 * orphaned browser (the HMR bug above) leaves it behind.
 *
 * This sweeper is DELIBERATELY paranoid — it deletes directories from disk:
 *  - only direct children of os.tmpdir() (never recursing into anything else);
 *  - only names matching the EXACT prefix below;
 *  - only entries that are real directories (lstat, so a symlink is skipped, never followed);
 *  - only entries older than `minAgeMinutes` (default 10);
 *  - never the profile of the currently running browser (the newest one is always spared when the
 *    renderer has a live browser).
 * It is never run automatically in production.
 */
const PROFILE_PREFIX = "playwright_chromiumdev_profile-";

export interface CleanupOptions {
  minAgeMinutes?: number;
  /** When true nothing is deleted; the would-be deletions are returned and logged. */
  dryRun?: boolean;
  tmpDir?: string;
}

export async function cleanupRendererTempProfiles(options: CleanupOptions = {}): Promise<string[]> {
  const minAgeMs = Math.max(1, options.minAgeMinutes ?? 10) * 60_000;
  const tmpDir = options.tmpDir ?? os.tmpdir();
  const state = getState();
  const removed: string[] = [];

  let entries: string[];
  try {
    entries = await fs.readdir(tmpDir);
  } catch (error) {
    logger.warn("cleanup de perfis temporarios abortado", {
      module: MODULE,
      metadata: { message: error instanceof Error ? error.message : String(error) }
    });
    return removed;
  }

  const now = Date.now();
  for (const name of entries) {
    if (!name.startsWith(PROFILE_PREFIX)) continue;
    const full = path.join(tmpDir, name);
    // Defensive: after join, the path must still be a direct child of tmpDir.
    if (path.dirname(full) !== path.resolve(tmpDir)) continue;

    try {
      const stat = await fs.lstat(full);
      if (!stat.isDirectory() || stat.isSymbolicLink()) continue;
      const age = now - stat.mtimeMs;
      if (age < minAgeMs) continue;
      // A profile younger than the live browser could belong to it — never touch it.
      if (state.browser?.isConnected() && state.createdAt && stat.birthtimeMs >= state.createdAt - 60_000) continue;

      if (!options.dryRun) await fs.rm(full, { recursive: true, force: true });
      removed.push(full);
    } catch {
      // Busy/locked/permission-denied: another process still owns it. Leave it alone.
    }
  }

  if (removed.length > 0) {
    logger.info("perfis temporarios do Playwright removidos", {
      module: MODULE,
      metadata: { count: removed.length, dryRun: options.dryRun === true, tmpDir }
    });
  }
  return removed;
}

/** Dev-only, conservative startup sweep (10 minutes is far older than any live dev browser). */
export function scheduleDevTempProfileCleanup(): void {
  if (isProduction || process.env.NODE_ENV === "test" || process.env.VITEST) return;
  void cleanupRendererTempProfiles({ minAgeMinutes: 10 }).catch(() => undefined);
}

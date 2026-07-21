import { defineConfig, devices } from "@playwright/test";

/**
 * Fase 46/47 (INSERIES-PRODUCT-EXPERIENCE-REVOLUTION-01) — infra de E2E/regressao visual.
 * Precisa de `npm run dev` (ou `npm run build && npm run start`) rodando com banco real —
 * nao sobe o servidor sozinho (`webServer` fica comentado de proposito): nesta maquina o
 * Docker Desktop nao consegue subir o Postgres local, entao os specs em e2e/ nao foram
 * executados nesta sessao. `npx playwright test --list` (sem servidor) confirma que os specs
 * pelo menos compilam/carregam corretamente.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: "html",
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure"
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile-chromium", use: { ...devices["Pixel 7"] } }
  ]
});

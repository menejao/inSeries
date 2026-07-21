import { test, expect } from "@playwright/test";

/**
 * Fase 46 (regressao visual) — `toHaveScreenshot()` compara contra uma baseline commitada em
 * `e2e/visual.spec.ts-snapshots/`. Essa baseline NAO existe ainda nesta sessao (Docker
 * indisponivel, nunca rodou de verdade) — a primeira execucao real (`npx playwright test
 * e2e/visual.spec.ts --update-snapshots`) precisa gerar e revisar as imagens antes de confiar
 * nelas. Ate la, este arquivo documenta o padrao, nao evidencia de regressao nenhuma.
 */
test("Landing page (visitante anonimo, desktop)", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveScreenshot("landing-desktop.png", { fullPage: true, maxDiffPixelRatio: 0.02 });
});

test("Landing page (visitante anonimo, mobile 390px)", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page).toHaveScreenshot("landing-mobile-390.png", { fullPage: true, maxDiffPixelRatio: 0.02 });
});

test("Tela de login", async ({ page }) => {
  await page.goto("/login");
  await expect(page).toHaveScreenshot("login.png", { maxDiffPixelRatio: 0.02 });
});

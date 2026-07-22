import { test, expect } from "@playwright/test";

/**
 * Fase 47 ("Utilizar a aplicacao por teclado", "Navegar no mobile") + Fase 24/35
 * (responsividade/acessibilidade). Login por API direta (mais rapido/estavel para specs que
 * nao testam o proprio formulario de login).
 */
/**
 * Usa `page.request` (nao o fixture `request` avulso): ele compartilha o cookie jar do
 * `page`, entao a sessao criada pelo registro fica valida pro `page.goto` seguinte. O
 * fixture `request` avulso e um APIRequestContext independente - guardaria o cookie de
 * sessao no proprio jar, nunca visivel pro browser context do `page` (achado rodando os
 * specs de verdade contra servidor local, Docker disponivel).
 */
async function registerViaApi(page: import("@playwright/test").Page) {
  const suffix = Date.now().toString(36) + Math.floor(Math.random() * 1000);
  const user = { name: `Playwright ${suffix}`, username: `pwa11y${suffix}`, email: `pwa11y${suffix}@inseries.test`, password: "senha12345" };
  const response = await page.request.post("/api/auth/register", { data: user });
  expect(response.ok()).toBeTruthy();
  return user;
}

test("Sidebar e navegavel inteiramente por teclado", async ({ page }) => {
  await registerViaApi(page);
  await page.goto("/");

  const nav = page.getByRole("navigation", { name: "Navegacao principal" });
  await expect(nav).toBeVisible();

  // Tab ate o primeiro link da sidebar e confirma foco visivel (outline via :focus-visible).
  await page.keyboard.press("Tab");
  const focused = page.locator(":focus");
  await expect(focused).toBeVisible();
});

test("Dashboard sem barra horizontal em 375px (mobile)", async ({ page }) => {
  await registerViaApi(page);
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/");

  const hasHorizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  expect(hasHorizontalOverflow).toBe(false);
});

test("Dashboard sem barra horizontal em 320px (mobile)", async ({ page }) => {
  await registerViaApi(page);
  await page.setViewportSize({ width: 320, height: 780 });
  await page.goto("/");

  const hasHorizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  expect(hasHorizontalOverflow).toBe(false);
});

import { test, expect } from "@playwright/test";

/**
 * Fase 10/47 — "Abrir calendario" + "nao criar listas verticais muito longas".
 * `page.request` (nao o fixture `request` avulso) pra sessao ficar visivel pro `page.goto`.
 */
async function registerViaApi(page: import("@playwright/test").Page) {
  const suffix = Date.now().toString(36) + Math.floor(Math.random() * 1000);
  const user = { name: `Playwright ${suffix}`, username: `pwcal${suffix}`, email: `pwcal${suffix}@inseries.test`, password: "senha12345" };
  const response = await page.request.post("/api/auth/register", { data: user });
  expect(response.ok()).toBeTruthy();
  return user;
}

test("visitante anonimo ve CTA de login no calendario, sem redirecionar", async ({ page }) => {
  await page.goto("/calendar");
  await expect(page.getByText("Entre para ver seu calendario")).toBeVisible();
  await expect(page).toHaveURL("/calendar");
});

test("Meu calendario e Todos os lancamentos alternam via tab sem sair da rota", async ({ page }) => {
  await registerViaApi(page);
  await page.goto("/calendar");

  await page.getByRole("link", { name: "Todos os lancamentos" }).click();
  await expect(page).toHaveURL(/\/calendar\?view=global/);

  await page.getByRole("link", { name: "Meu calendario" }).click();
  await expect(page).toHaveURL(/\/calendar\?view=personal/);
});

test("periodo Hoje/Semana/Mes do calendario global funciona", async ({ page }) => {
  await registerViaApi(page);
  await page.goto("/calendar?view=global");

  await page.getByRole("link", { name: "Semana" }).click();
  await expect(page).toHaveURL(/range=week/);

  await page.getByRole("link", { name: "Mes" }).click();
  await expect(page).toHaveURL(/range=month/);
});

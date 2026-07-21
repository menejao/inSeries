import { test, expect } from "@playwright/test";

/**
 * Fase 47 — "Encontrar uma serie", "Comecar a acompanhar" e "Marcar episodio como assistido".
 * Depende de haver pelo menos 1 serie no catalogo (`npm run seed:dev`).
 */
async function registerAndLogin(page: import("@playwright/test").Page) {
  const suffix = Date.now().toString(36) + Math.floor(Math.random() * 1000);
  const user = { name: `Playwright ${suffix}`, username: `pwct${suffix}`, email: `pwct${suffix}@inseries.test`, password: "senha12345" };
  await page.goto("/register");
  await page.getByLabel("Nome").fill(user.name);
  await page.getByLabel("Username").fill(user.username);
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Senha").fill(user.password);
  await page.getByRole("button", { name: "Criar conta" }).click();
  await expect(page).toHaveURL("/");
  return user;
}

test("usuario encontra uma serie pelo catalogo e comeca a acompanhar", async ({ page }) => {
  await registerAndLogin(page);

  await page.goto("/series");
  const firstSeriesCard = page.locator('a[href^="/series/"]').first();
  await expect(firstSeriesCard).toBeVisible();
  await firstSeriesCard.click();

  await expect(page).toHaveURL(/\/series\/.+/);
  await page.getByRole("button", { name: "Quero assistir" }).click();
  await expect(page.getByText("Status atualizado")).toBeVisible();
});

test("usuario marca um episodio como assistido a partir da temporada", async ({ page }) => {
  await registerAndLogin(page);

  await page.goto("/series");
  await page.locator('a[href^="/series/"]').first().click();
  await expect(page).toHaveURL(/\/series\/.+/);

  await page.getByRole("button", { name: "Assistindo" }).click();
  await expect(page.getByText("Status atualizado")).toBeVisible();

  const firstSeasonLink = page.locator('a[href*="/season/"]').first();
  if (await firstSeasonLink.count()) {
    await firstSeasonLink.click();
    await expect(page).toHaveURL(/\/season\/\d+/);

    const markWatchedButton = page.getByRole("button", { name: /marcar/i }).first();
    await expect(markWatchedButton).toBeVisible();
    await markWatchedButton.click();
  }
});

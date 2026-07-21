import { test, expect } from "@playwright/test";

/**
 * Fase 47 — "Visualizar proximo lancamento" e "Abrir calendario" a partir do Dashboard.
 */
async function registerAndLogin(page: import("@playwright/test").Page) {
  const suffix = Date.now().toString(36) + Math.floor(Math.random() * 1000);
  const user = { name: `Playwright ${suffix}`, username: `pwdc${suffix}`, email: `pwdc${suffix}@inseries.test`, password: "senha12345" };
  await page.goto("/register");
  await page.getByLabel("Nome").fill(user.name);
  await page.getByLabel("Username").fill(user.username);
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Senha").fill(user.password);
  await page.getByRole("button", { name: "Criar conta" }).click();
  await expect(page).toHaveURL("/");
  return user;
}

test("Dashboard mostra as secoes operacionais esperadas", async ({ page }) => {
  await registerAndLogin(page);
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Continuar assistindo" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Novos para voce" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Agenda resumida" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Atalhos rapidos" })).toBeVisible();
});

test("usuario abre o calendario a partir do Dashboard", async ({ page }) => {
  await registerAndLogin(page);
  await page.goto("/");

  await page.getByRole("link", { name: "Abrir calendario" }).click();
  await expect(page).toHaveURL("/calendar");
});

test("Dashboard nao repete secoes descontinuadas (Bombando Agora, Watch Next, etc)", async ({ page }) => {
  await registerAndLogin(page);
  await page.goto("/");

  await expect(page.getByText("Bombando Agora")).toHaveCount(0);
  await expect(page.getByText("Watch Next")).toHaveCount(0);
  await expect(page.getByText("Proximos episodios")).toHaveCount(0);
});

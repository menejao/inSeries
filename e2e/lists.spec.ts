import { test, expect } from "@playwright/test";

/** Fase 47 — "Criar lista" e "Adicionar serie a lista", agora na rota unificada /lists?view=minhas. */
async function registerAndLogin(page: import("@playwright/test").Page) {
  const suffix = Date.now().toString(36) + Math.floor(Math.random() * 1000);
  const user = { name: `Playwright ${suffix}`, username: `pwl${suffix}`, email: `pwl${suffix}@inseries.test`, password: "senha12345" };
  await page.goto("/register");
  await page.getByLabel("Nome").fill(user.name);
  await page.getByLabel("Username").fill(user.username);
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Senha").fill(user.password);
  await page.getByRole("button", { name: "Criar conta" }).click();
  await expect(page).toHaveURL("/");
  return user;
}

test("usuario cria uma lista pela aba Minhas listas", async ({ page }) => {
  await registerAndLogin(page);
  await page.goto("/lists?view=minhas");

  await expect(page.getByRole("heading", { name: "Minhas listas" })).toBeVisible();

  const title = `Lista de teste ${Date.now()}`;
  await page.getByLabel("Titulo").fill(title);
  await page.getByRole("button", { name: "Criar lista" }).click();

  await expect(page.getByText("Lista criada")).toBeVisible();
  await expect(page.getByText(title)).toBeVisible();
});

test("aba Descobrir e Minhas listas alternam sem sair da rota /lists", async ({ page }) => {
  await registerAndLogin(page);
  await page.goto("/lists");

  await page.getByRole("link", { name: "Minhas listas" }).click();
  await expect(page).toHaveURL(/\/lists\?view=minhas/);

  await page.getByRole("link", { name: "Descobrir" }).click();
  await expect(page).toHaveURL("/lists");
});

test("visitante anonimo em /lists?view=minhas e redirecionado para login", async ({ page }) => {
  await page.goto("/lists?view=minhas");
  await expect(page).toHaveURL("/login");
});

import { test, expect } from "@playwright/test";

/**
 * Fase 47 (INSERIES-PRODUCT-EXPERIENCE-REVOLUTION-01) — "Entrar no sistema" e o primeiro
 * fluxo obrigatorio da lista do ticket. Cada teste cria sua propria conta (via /register) em
 * vez de depender de dado semeado, entao roda em qualquer banco limpo.
 */
function uniqueUser() {
  const suffix = Date.now().toString(36) + Math.floor(Math.random() * 1000);
  return { name: `Playwright ${suffix}`, username: `pw${suffix}`, email: `pw${suffix}@inseries.test`, password: "senha12345" };
}

test("usuario consegue criar conta e cai no Dashboard", async ({ page }) => {
  const user = uniqueUser();

  await page.goto("/register");
  await page.getByLabel("Nome").fill(user.name);
  await page.getByLabel("Username").fill(user.username);
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Senha").fill(user.password);
  await page.getByRole("button", { name: "Criar conta" }).click();

  await expect(page).toHaveURL("/");
  await expect(page.getByText(`Ola, ${user.name.split(" ")[0]}`)).toBeVisible();
});

test("usuario consegue fazer login com uma conta existente", async ({ page }) => {
  const user = uniqueUser();

  await page.goto("/register");
  await page.getByLabel("Nome").fill(user.name);
  await page.getByLabel("Username").fill(user.username);
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Senha").fill(user.password);
  await page.getByRole("button", { name: "Criar conta" }).click();
  await expect(page).toHaveURL("/");

  await page.context().clearCookies();
  await page.goto("/login");
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Senha").fill(user.password);
  await page.getByRole("button", { name: "Entrar" }).click();

  await expect(page).toHaveURL("/");
});

test("credenciais invalidas mostram erro sem navegar", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill("naoexiste@inseries.test");
  await page.getByLabel("Senha").fill("senhaerrada123");
  await page.getByRole("button", { name: "Entrar" }).click();

  await expect(page.getByText("Nao foi possivel continuar")).toBeVisible();
  await expect(page).toHaveURL("/login");
});

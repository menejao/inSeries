import { test, expect } from "@playwright/test";

/** Fase 47 — "Alterar preferencias", agora dividido em abas (Fase 19). */
async function registerViaApi(request: import("@playwright/test").APIRequestContext) {
  const suffix = Date.now().toString(36) + Math.floor(Math.random() * 1000);
  const user = { name: `Playwright ${suffix}`, username: `pwset${suffix}`, email: `pwset${suffix}@inseries.test`, password: "senha12345" };
  const response = await request.post("/api/auth/register", { data: user });
  expect(response.ok()).toBeTruthy();
  return user;
}

test("Configuracoes abre na aba Perfil por padrao", async ({ page, request }) => {
  await registerViaApi(request);
  await page.goto("/settings");
  await expect(page.getByRole("heading", { name: "Editar perfil" })).toBeVisible();
});

test("aba Privacidade troca sem sair de /settings e mostra os toggles", async ({ page, request }) => {
  await registerViaApi(request);
  await page.goto("/settings");

  await page.getByRole("link", { name: "Privacidade" }).click();
  await expect(page).toHaveURL(/\/settings\?tab=privacidade/);
  await expect(page.getByText("Perfil privado")).toBeVisible();
});

test("aba Aparencia mostra o alternador de tema", async ({ page, request }) => {
  await registerViaApi(request);
  await page.goto("/settings?tab=aparencia");
  await expect(page.getByRole("heading", { name: "Aparencia" })).toBeVisible();
});

test("salvar a aba Perfil nao afeta os toggles de privacidade", async ({ page, request }) => {
  await registerViaApi(request);
  await page.goto("/settings");

  await page.getByLabel("Nome").fill("Nome Atualizado");
  await page.getByRole("button", { name: "Salvar alteracoes" }).click();
  await expect(page.getByText("Perfil atualizado")).toBeVisible();

  await page.getByRole("link", { name: "Privacidade" }).click();
  await expect(page.getByText("Perfil privado")).toBeVisible();
});

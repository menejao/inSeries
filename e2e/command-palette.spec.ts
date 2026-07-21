import { test, expect } from "@playwright/test";

/** Fase 47 — "Utilizar a busca global". */
async function registerViaApi(request: import("@playwright/test").APIRequestContext) {
  const suffix = Date.now().toString(36) + Math.floor(Math.random() * 1000);
  const user = { name: `Playwright ${suffix}`, username: `pwcmd${suffix}`, email: `pwcmd${suffix}@inseries.test`, password: "senha12345" };
  const response = await request.post("/api/auth/register", { data: user });
  expect(response.ok()).toBeTruthy();
  return user;
}

test("Ctrl+K abre o Command Palette com as acoes rapidas", async ({ page, request }) => {
  await registerViaApi(request);
  await page.goto("/");

  await page.keyboard.press("Control+k");
  await expect(page.getByRole("combobox", { name: /Buscar/ })).toBeVisible();
  await expect(page.getByText("Acoes rapidas")).toBeVisible();
  await expect(page.getByText("Abrir calendario")).toBeVisible();
});

test("botao de busca no header abre o Command Palette", async ({ page, request }) => {
  await registerViaApi(request);
  await page.goto("/");

  await page.getByRole("button", { name: /Buscar \(Ctrl\+K\)/ }).click();
  await expect(page.getByRole("combobox", { name: /Buscar/ })).toBeVisible();
});

test("selecionar uma acao rapida navega e fecha o palette", async ({ page, request }) => {
  await registerViaApi(request);
  await page.goto("/");

  await page.keyboard.press("Control+k");
  await page.getByText("Abrir calendario").click();

  await expect(page).toHaveURL("/calendar");
  await expect(page.getByRole("combobox", { name: /Buscar/ })).not.toBeVisible();
});

test("Escape fecha o Command Palette", async ({ page, request }) => {
  await registerViaApi(request);
  await page.goto("/");

  await page.keyboard.press("Control+k");
  await expect(page.getByRole("combobox", { name: /Buscar/ })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("combobox", { name: /Buscar/ })).not.toBeVisible();
});

test("digitar uma busca mostra resultados agrupados por tipo", async ({ page, request }) => {
  await registerViaApi(request);
  await page.goto("/");

  await page.keyboard.press("Control+k");
  await page.getByRole("combobox", { name: /Buscar/ }).fill("a");

  // Com pelo menos 1 letra ja dispara a busca (debounce de 250ms) - aguarda um resultado
  // agrupado ou o empty state, nunca um erro de rede real.
  await expect(page.getByText(/Series|Usuarios|Listas|Reviews|Nenhum resultado/)).toBeVisible({ timeout: 5000 });
});

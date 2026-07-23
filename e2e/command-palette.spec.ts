import { test, expect } from "@playwright/test";

/** Fase 47 — "Utilizar a busca global". */
async function registerViaApi(page: import("@playwright/test").Page) {
  const suffix = Date.now().toString(36) + Math.floor(Math.random() * 1000);
  const user = { name: `Playwright ${suffix}`, username: `pwcmd${suffix}`, email: `pwcmd${suffix}@inseries.test`, password: "senha12345" };
  const response = await page.request.post("/api/auth/register", { data: user });
  expect(response.ok()).toBeTruthy();
  return user;
}

test("Ctrl+K abre o Command Palette com as acoes rapidas", async ({ page }) => {
  await registerViaApi(page);
  await page.goto("/");
  // Ctrl+K e um listener global registrado so apos a hidratacao do client component; esperar
  // o botao de busca do header (mesmo componente/mount) ficar visivel evita mandar o atalho
  // antes do listener existir (achado rodando os specs de verdade - flakiness intermitente).
  await expect(page.getByRole("button", { name: /Buscar \(Ctrl\+K\)/ })).toBeVisible();

  await page.keyboard.press("Control+k");
  await expect(page.getByRole("combobox", { name: /Buscar/ })).toBeVisible();
  await expect(page.getByText("Acoes rapidas")).toBeVisible();
  await expect(page.getByText("Abrir calendario")).toBeVisible();
});

test("botao de busca no header abre o Command Palette", async ({ page }) => {
  await registerViaApi(page);
  await page.goto("/");
  // Mesma corrida de hidratacao dos outros testes deste arquivo: o onClick do botao so e
  // anexado depois que o client component hidrata, mesmo com o botao ja visivel no HTML
  // server-renderizado - Playwright's actionability check (visible/stable) nao garante isso.
  const searchButton = page.getByRole("button", { name: /Buscar \(Ctrl\+K\)/ });
  await expect(searchButton).toBeVisible();

  await searchButton.click();
  await expect(page.getByRole("combobox", { name: /Buscar/ })).toBeVisible();
});

test("selecionar uma acao rapida navega e fecha o palette", async ({ page }) => {
  await registerViaApi(page);
  await page.goto("/");
  // Ctrl+K e um listener global registrado so apos a hidratacao do client component; esperar
  // o botao de busca do header (mesmo componente/mount) ficar visivel evita mandar o atalho
  // antes do listener existir (achado rodando os specs de verdade - flakiness intermitente).
  await expect(page.getByRole("button", { name: /Buscar \(Ctrl\+K\)/ })).toBeVisible();

  await page.keyboard.press("Control+k");
  await page.getByText("Abrir calendario").click();

  await expect(page).toHaveURL("/calendar");
  await expect(page.getByRole("combobox", { name: /Buscar/ })).not.toBeVisible();
});

test("Escape fecha o Command Palette", async ({ page }) => {
  await registerViaApi(page);
  await page.goto("/");
  // Ctrl+K e um listener global registrado so apos a hidratacao do client component; esperar
  // o botao de busca do header (mesmo componente/mount) ficar visivel evita mandar o atalho
  // antes do listener existir (achado rodando os specs de verdade - flakiness intermitente).
  await expect(page.getByRole("button", { name: /Buscar \(Ctrl\+K\)/ })).toBeVisible();

  await page.keyboard.press("Control+k");
  await expect(page.getByRole("combobox", { name: /Buscar/ })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("combobox", { name: /Buscar/ })).not.toBeVisible();
});

test("digitar uma busca mostra resultados agrupados por tipo", async ({ page }) => {
  await registerViaApi(page);
  await page.goto("/");
  // Ctrl+K e um listener global registrado so apos a hidratacao do client component; esperar
  // o botao de busca do header (mesmo componente/mount) ficar visivel evita mandar o atalho
  // antes do listener existir (achado rodando os specs de verdade - flakiness intermitente).
  await expect(page.getByRole("button", { name: /Buscar \(Ctrl\+K\)/ })).toBeVisible();

  await page.keyboard.press("Control+k");
  await page.getByRole("combobox", { name: /Buscar/ }).fill("a");

  // Com pelo menos 1 letra ja dispara a busca (debounce de 250ms) - aguarda um resultado
  // agrupado ou o empty state, nunca um erro de rede real. Escopado ao listbox do palette
  // (nao a pagina toda): "Series"/"Listas" tambem aparecem no header/sidebar por tras do
  // overlay (ex.: logo "inSeries" contem a substring "Series"), o que violava o modo
  // estrito do Playwright (varios elementos casavam o regex fora do palette).
  const results = page.getByRole("listbox", { name: "Resultados" });
  await expect(results.getByText(/Series|Usuarios|Listas|Reviews|Nenhum resultado/).first()).toBeVisible({ timeout: 5000 });
});

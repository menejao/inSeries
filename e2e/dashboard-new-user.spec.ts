import { test, expect } from "@playwright/test";

/**
 * Fase 8 (INSERIES-PRODUCT-EXPERIENCE-REVOLUTION-01) — conteudo adaptativo por estado do
 * usuario: quem nao acompanha nenhuma serie nao deve ver "Novos para voce"/"Agenda resumida"
 * (ambas sempre vazias nesse caso) empilhados como parede de empty states.
 */
async function registerViaApi(request: import("@playwright/test").APIRequestContext) {
  const suffix = Date.now().toString(36) + Math.floor(Math.random() * 1000);
  const user = { name: `Playwright ${suffix}`, username: `pwnew${suffix}`, email: `pwnew${suffix}@inseries.test`, password: "senha12345" };
  const response = await request.post("/api/auth/register", { data: user });
  expect(response.ok()).toBeTruthy();
  return user;
}

test("usuario novo (sem series) ve mensagem de boas-vindas, sem Novos/Agenda", async ({ page, request }) => {
  await registerViaApi(request);
  await page.goto("/");

  await expect(page.getByText("Bem-vindo ao inSeries")).toBeVisible();
  await expect(page.getByText("Voce ainda nao comecou nenhuma serie")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Novos para voce" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Agenda resumida" })).toHaveCount(0);
});

test("usuario novo ainda ve Atalhos rapidos e Atividade recente", async ({ page, request }) => {
  await registerViaApi(request);
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Atalhos rapidos" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Atividade recente" })).toBeVisible();
});

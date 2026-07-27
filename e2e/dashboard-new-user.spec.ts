import { test, expect } from "@playwright/test";

/**
 * Fase 8 (INSERIES-PRODUCT-EXPERIENCE-REVOLUTION-01) — conteudo adaptativo por estado do
 * usuario: quem nao acompanha nenhuma serie nao deve ver "Pendencias recentes"/"Proximos
 * episodios" (ambas sempre vazias nesse caso) empilhados como parede de empty states.
 */
async function registerViaApi(page: import("@playwright/test").Page) {
  const suffix = Date.now().toString(36) + Math.floor(Math.random() * 1000);
  const user = { name: `Playwright ${suffix}`, username: `pwnew${suffix}`, email: `pwnew${suffix}@inseries.test`, password: "senha12345" };
  const response = await page.request.post("/api/auth/register", { data: user });
  expect(response.ok()).toBeTruthy();
  return user;
}

test("usuario novo (sem series) ve mensagem de boas-vindas, sem Novos/Agenda", async ({ page }) => {
  await registerViaApi(page);
  await page.goto("/");

  await expect(page.getByText("Bem-vindo ao inSeries")).toBeVisible();
  await expect(page.getByText("Voce ainda nao comecou nenhuma serie")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Pendencias recentes" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Proximos episodios" })).toHaveCount(0);
});

test("usuario novo ve o CTA de Assistir a seguir para comecar a acompanhar", async ({ page }) => {
  await registerViaApi(page);
  await page.goto("/");

  // Redesign completo do Dashboard cortou "Atalhos rapidos"/"Atividade recente" (navegacao
  // redundante com Sidebar/BottomNav e timeline passiva ja coberta por /profile+/me/recap).
  // INSERIES-DASHBOARD-HOME-EXPERIENCE-03 removeu tambem o card "Agora" e a busca duplicada;
  // INSERIES-DASHBOARD-AND-MY-LIST-EXPERIENCE-01 renomeou "Continuar acompanhando" pra
  // "Assistir a seguir" - a unica secao que sobra pro usuario novo, com seu proprio empty
  // state acionavel.
  await expect(page.getByRole("heading", { name: "Assistir a seguir" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Explorar catalogo" })).toBeVisible();
});

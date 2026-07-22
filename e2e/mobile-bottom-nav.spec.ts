import { test, expect } from "@playwright/test";

/**
 * Emulacao de dispositivo mobile real vem do project "mobile-chromium" (playwright.config.ts,
 * devices["Pixel 7"]) - rodar com `npx playwright test --project=mobile-chromium`.
 */
async function registerViaApi(page: import("@playwright/test").Page) {
  const suffix = Date.now().toString(36) + Math.floor(Math.random() * 1000);
  const user = { name: `Playwright ${suffix}`, username: `pwmob${suffix}`, email: `pwmob${suffix}@inseries.test`, password: "senha12345" };
  const response = await page.request.post("/api/auth/register", { data: user });
  expect(response.ok()).toBeTruthy();
  return user;
}

test("BottomNav aparece no mobile sem gerar scroll horizontal", async ({ page }) => {
  await registerViaApi(page);
  await page.goto("/");

  await expect(page.getByRole("navigation", { name: "Navegacao principal" })).toBeVisible();
  const hasHorizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  expect(hasHorizontalOverflow).toBe(false);
});

import { defineConfig } from "vitest/config";

/**
 * Fase 46/47 (INSERIES-PRODUCT-EXPERIENCE-REVOLUTION-01) — primeiro framework de teste real
 * do projeto (antes so existia scripts/smoke-test.ts, um script HTTP escrito a mao). Escopo
 * inicial: funcoes puras de lib/ que ja existiam sem cobertura (dedupe, agenda, dates, utils).
 * Node environment (nao jsdom) - nenhum teste de componente React ainda, so logica pura.
 */
export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    environment: "node",
    include: ["**/*.test.ts"],
    exclude: ["node_modules", ".next", "e2e"]
  }
});

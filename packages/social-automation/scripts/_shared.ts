/** Simple `--key value` flag parsing shared by the social:* CLI scripts. */
export function parseFlags(argv: string[]): Record<string, string> {
  const flags: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith("--")) {
      const key = arg.slice(2);
      const value = argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[++i] : "true";
      flags[key] = value;
    }
  }
  return flags;
}

/**
 * DB connectivity/schema errors are expected in this sandbox — either there's no live
 * DATABASE_URL at all, or there is one but `prisma migrate`/`db push` was never run for the new
 * Social* tables (this ticket intentionally doesn't run migrations). Report both cases clearly
 * instead of a raw stack trace.
 */
export function isLikelyDbConnectivityError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  const code = (error as { code?: string } | undefined)?.code;
  if (code === "P2021" || code === "P2022") return true; // table/column does not exist
  return /ECONNREFUSED|P1001|P1002|P1003|Can't reach database|Environment variable not found: DATABASE_URL|does not exist in the current database/i.test(
    message
  );
}

export function reportError(scriptName: string, error: unknown) {
  if (isLikelyDbConnectivityError(error)) {
    console.error(`[${scriptName}] Falhou por banco indisponivel/schema nao migrado (esperado neste ambiente sem migrations aplicadas):`);
    console.error(`  ${error instanceof Error ? error.message : String(error)}`);
    console.error(`  O fluxo de codigo ate esse ponto (config, geradores, publisher registry) executou normalmente.`);
    process.exitCode = 1;
    return;
  }

  console.error(`[${scriptName}] Falha inesperada:`);
  console.error(error);
  process.exitCode = 1;
}

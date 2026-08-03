import { execFileSync } from "node:child_process";
import { assertSafeToRun, GuardBlockedError, type GuardAction } from "./guard";
import { runBackup } from "./backup";
import { EnvResolutionError, hydrateProcessEnv, resolveDatabaseUrl } from "./resolve-env";

/**
 * Variáveis que o guard depende e que o `tsx` (ao contrário do `next` e do Prisma CLI) não
 * carrega sozinho. Antes isso era feito com `loadEnvConfig()` do `@next/env`, que sem o flag
 * `dev` lia `.env.production.local` — arquivo com placeholders `"[SENSITIVE]"` — com a maior
 * precedência. Ver scripts/db-guard/resolve-env.ts e docs/database-migrations.md.
 */
const GUARD_ENV_VARS = ["DATABASE_URL", "SHADOW_DATABASE_URL", "DB_ENVIRONMENT"] as const;

const NEEDS_BACKUP: GuardAction[] = ["create", "deploy"];

function prismaArgsFor(action: GuardAction): string[] {
  switch (action) {
    case "check":
      return ["migrate", "diff", "--from-migrations", "prisma/migrations", "--to-schema-datamodel", "prisma/schema.prisma", "--shadow-database-url", process.env.SHADOW_DATABASE_URL ?? ""];
    case "create":
      return ["migrate", "dev", "--create-only"];
    case "deploy":
      return ["migrate", "deploy"];
    case "status":
      return ["migrate", "status"];
  }
}

export function isGuardAction(value: string | undefined): value is GuardAction {
  return value === "check" || value === "create" || value === "deploy" || value === "status";
}

export type CliDeps = {
  hydrate: typeof hydrateProcessEnv;
  resolveDb: typeof resolveDatabaseUrl;
  guard: typeof assertSafeToRun;
  backup: typeof runBackup;
  runPrisma: (args: string[]) => void;
};

const defaultDeps: CliDeps = {
  hydrate: hydrateProcessEnv,
  resolveDb: resolveDatabaseUrl,
  guard: assertSafeToRun,
  backup: runBackup,
  runPrisma: (args) => {
    // On Windows, `npx` resolves to npx.cmd — execFileSync needs shell:true there to find it
    // (matches how npm itself invokes .cmd shims); harmless on POSIX where npx is already on PATH.
    execFileSync("npx", ["prisma", ...args], { stdio: "inherit", shell: process.platform === "win32" });
  }
};

/** Ordem fixa: resolução de env -> guard -> backup obrigatório -> Prisma. */
export function runCli(action: GuardAction, rest: string[], deps: CliDeps = defaultDeps): void {
  const report = deps.hydrate(GUARD_ENV_VARS);
  // Valida cedo: erro de env aborta antes do guard, do backup e de qualquer chamada ao Prisma.
  deps.resolveDb();
  console.log(`[db-guard] DATABASE_URL resolvida a partir de: ${report.DATABASE_URL ?? "process"}`);

  deps.guard(action, rest);

  if (NEEDS_BACKUP.includes(action)) {
    console.log("[db-guard] gerando backup obrigatório antes de comando que pode alterar schema...");
    try {
      deps.backup();
    } catch (error) {
      throw new Error(`${(error as Error).message}\n[db-guard] backup falhou — comando NÃO será executado.`);
    }
  }

  const prismaArgs = [...prismaArgsFor(action), ...rest];
  console.log(`[db-guard] executando: npx prisma ${prismaArgs.join(" ")}`);
  deps.runPrisma(prismaArgs);
}

function main() {
  const [, , action, ...rest] = process.argv;

  if (!isGuardAction(action)) {
    console.error(`[db-guard] ação desconhecida: "${action}". Use: check | create | deploy | status`);
    process.exit(1);
  }

  try {
    runCli(action, rest);
  } catch (error) {
    if (error instanceof GuardBlockedError || error instanceof EnvResolutionError) {
      console.error(error.message);
      process.exit(1);
    }
    console.error((error as Error).message);
    console.error("[db-guard] comando NÃO foi concluído.");
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

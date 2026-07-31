import { execFileSync } from "node:child_process";
import { assertSafeToRun, GuardBlockedError, type GuardAction } from "./guard";
import { runBackup } from "./backup";

const [, , action, ...rest] = process.argv;

const PRISMA_ARGS: Record<GuardAction, string[]> = {
  check: ["migrate", "diff", "--from-migrations", "prisma/migrations", "--to-schema-datamodel", "prisma/schema.prisma", "--shadow-database-url", process.env.SHADOW_DATABASE_URL ?? ""],
  create: ["migrate", "dev", "--create-only"],
  deploy: ["migrate", "deploy"],
  status: ["migrate", "status"]
};

const NEEDS_BACKUP: GuardAction[] = ["create", "deploy"];

function isGuardAction(value: string | undefined): value is GuardAction {
  return value === "check" || value === "create" || value === "deploy" || value === "status";
}

function main() {
  if (!isGuardAction(action)) {
    console.error(`[db-guard] ação desconhecida: "${action}". Use: check | create | deploy | status`);
    process.exit(1);
  }

  try {
    assertSafeToRun(action, rest);
  } catch (error) {
    if (error instanceof GuardBlockedError) {
      console.error(error.message);
      process.exit(1);
    }
    throw error;
  }

  if (NEEDS_BACKUP.includes(action)) {
    console.log("[db-guard] gerando backup obrigatório antes de comando que pode alterar schema...");
    try {
      runBackup();
    } catch (error) {
      console.error((error as Error).message);
      console.error("[db-guard] backup falhou — comando NÃO será executado.");
      process.exit(1);
    }
  }

  const prismaArgs = [...PRISMA_ARGS[action], ...rest];
  console.log(`[db-guard] executando: npx prisma ${prismaArgs.join(" ")}`);
  execFileSync("npx", ["prisma", ...prismaArgs], { stdio: "inherit" });
}

main();

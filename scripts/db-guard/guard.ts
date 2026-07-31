import { maskDatabaseUrl, parseDbIdentity, sameDatabase } from "./mask";

export type GuardAction = "check" | "create" | "deploy" | "status";

const DESTRUCTIVE_TOKENS = ["migrate reset", "db push", "--force-reset", "--accept-data-loss"];

export class GuardBlockedError extends Error {}

/**
 * Central safety gate every Prisma-touching npm script routes through (see
 * docs/database-migrations.md). Nothing here mutates the database — it only decides whether the
 * real `prisma` invocation downstream is allowed to run, and never leaks credentials while
 * explaining why.
 */
export function assertSafeToRun(action: GuardAction, rawArgs: string[]) {
  const joinedCommand = `prisma ${action} ${rawArgs.join(" ")}`.trim();

  for (const token of DESTRUCTIVE_TOKENS) {
    if (joinedCommand.includes(token) && process.env.ALLOW_DESTRUCTIVE_MIGRATION !== "1") {
      throw new GuardBlockedError(
        `[db-guard] comando bloqueado: contém "${token}". ` +
          `Defina ALLOW_DESTRUCTIVE_MIGRATION=1 explicitamente para permitir (nunca em automação/agente).`
      );
    }
  }

  const dbEnvironment = process.env.DB_ENVIRONMENT;
  if (!dbEnvironment) {
    throw new GuardBlockedError(
      "[db-guard] comando bloqueado: DB_ENVIRONMENT não definido. " +
        'Defina DB_ENVIRONMENT="development" (ou homologation/production) explicitamente antes de rodar comandos Prisma.'
    );
  }

  const databaseUrl = process.env.DATABASE_URL;
  const shadowUrl = process.env.SHADOW_DATABASE_URL;
  const dbIdentity = parseDbIdentity(databaseUrl);
  const shadowIdentity = parseDbIdentity(shadowUrl);

  if (action === "create" || action === "check") {
    // These two paths make Prisma compute a schema diff, which needs a real, distinct shadow db.
    if (!shadowUrl) {
      throw new GuardBlockedError(
        "[db-guard] comando bloqueado: SHADOW_DATABASE_URL não definido — obrigatório para diff/migrate dev."
      );
    }
    if (sameDatabase(dbIdentity, shadowIdentity)) {
      throw new GuardBlockedError(
        `[db-guard] comando bloqueado: DATABASE_URL e SHADOW_DATABASE_URL apontam para o mesmo banco/schema ` +
          `(${maskDatabaseUrl(databaseUrl)} == ${maskDatabaseUrl(shadowUrl)}). ` +
          "Isso foi a causa raiz de uma perda de dados anterior — ver docs/database-migrations.md."
      );
    }
  }

  if (action === "create") {
    if (dbEnvironment !== "development") {
      throw new GuardBlockedError(
        `[db-guard] comando bloqueado: "migrate dev" (create) só é permitido com DB_ENVIRONMENT=development (atual: ${dbEnvironment}).`
      );
    }
    if (!process.stdin.isTTY) {
      throw new GuardBlockedError(
        "[db-guard] comando bloqueado: \"migrate dev\" requer um terminal interativo (stdin TTY). " +
          "Rodando sem TTY, um prompt de reset do Prisma pode ser silenciosamente confirmado por EOF — " +
          "foi exatamente isso que causou a perda de dados anterior. Rode este comando manualmente num terminal real."
      );
    }
  }

  if (action === "deploy" && !databaseUrl) {
    throw new GuardBlockedError("[db-guard] comando bloqueado: DATABASE_URL não definido.");
  }

  console.log(`[db-guard] ambiente: ${dbEnvironment}`);
  console.log(`[db-guard] DATABASE_URL: ${maskDatabaseUrl(databaseUrl)}`);
  console.log(`[db-guard] SHADOW_DATABASE_URL: ${maskDatabaseUrl(shadowUrl)}`);
  console.log(`[db-guard] comando liberado: ${joinedCommand.replace(/(:\/\/[^:]+:)[^@]+(@)/g, "$1***$2")}`);
}

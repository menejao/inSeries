import { existsSync, mkdirSync, readdirSync, statSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { maskDatabaseUrl, parseDbIdentity } from "./mask";

const BACKUP_DIR = join(process.cwd(), "backups");
const RETENTION_COUNT = 10;
const CONTAINER_NAME = process.env.DB_GUARD_CONTAINER ?? "inseries-postgres";

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function applyRetention() {
  if (!existsSync(BACKUP_DIR)) return;
  const files = readdirSync(BACKUP_DIR)
    .filter((f) => f.endsWith(".dump"))
    .map((f) => ({ name: f, mtime: statSync(join(BACKUP_DIR, f)).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime);

  for (const stale of files.slice(RETENTION_COUNT)) {
    unlinkSync(join(BACKUP_DIR, stale.name));
    console.log(`[db-backup] removido backup antigo (retenção ${RETENTION_COUNT}): ${stale.name}`);
  }
}

/** Runs `pg_dump -F c` inside the Postgres container and copies the dump out. Throws on any failure — callers must treat a failed backup as a hard stop, never proceed with a migration. */
export function runBackup(): string {
  const dbUrl = process.env.DATABASE_URL;
  const identity = parseDbIdentity(dbUrl);
  if (!identity) {
    throw new Error("[db-backup] DATABASE_URL ausente ou inválida — abortando backup.");
  }

  mkdirSync(BACKUP_DIR, { recursive: true });
  const file = `inseries_${identity.database}_${timestamp()}.dump`;
  const containerPath = `/tmp/${file}`;
  const hostPath = join(BACKUP_DIR, file);

  console.log(`[db-backup] banco: ${maskDatabaseUrl(dbUrl)}`);
  console.log(`[db-backup] gerando dump em ${containerPath} (container ${CONTAINER_NAME})...`);

  try {
    execFileSync(
      "docker",
      ["exec", CONTAINER_NAME, "pg_dump", "-U", "inseries", "-d", identity.database, "-F", "c", "-f", containerPath],
      { stdio: "inherit" }
    );
    execFileSync("docker", ["cp", `${CONTAINER_NAME}:${containerPath}`, hostPath], { stdio: "inherit" });
    execFileSync("docker", ["exec", CONTAINER_NAME, "rm", "-f", containerPath], { stdio: "inherit" });
  } catch (error) {
    throw new Error(`[db-backup] falha ao gerar/copiar backup — migração NÃO deve prosseguir: ${(error as Error).message}`);
  }

  if (!existsSync(hostPath) || statSync(hostPath).size === 0) {
    throw new Error(`[db-backup] arquivo de backup ausente ou vazio em ${hostPath} — migração NÃO deve prosseguir.`);
  }

  console.log(`[db-backup] ok: ${hostPath} (${statSync(hostPath).size} bytes)`);
  applyRetention();
  return hostPath;
}

if (require.main === module) {
  try {
    runBackup();
  } catch (error) {
    console.error((error as Error).message);
    process.exit(1);
  }
}

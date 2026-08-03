import { existsSync, mkdirSync, readdirSync, statSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { maskDatabaseUrl, parseDbIdentity, type DbIdentity } from "./mask";
import { EnvResolutionError, resolveDatabaseUrl, type EnvLike } from "./resolve-env";

const RETENTION_COUNT = 10;

function defaultContainer() {
  return process.env.DB_GUARD_CONTAINER ?? "inseries-postgres";
}

function defaultBackupDir() {
  return join(process.cwd(), "backups");
}

export function timestamp(now: Date = new Date()) {
  return now.toISOString().replace(/[:.]/g, "-");
}

export type BackupPlan = {
  identity: DbIdentity;
  /** URL já mascarada — seguro para log. */
  maskedUrl: string;
  container: string;
  backupDir: string;
  hostPath: string;
  containerPath: string;
  /** argv completo de cada subprocesso, na ordem de execução. */
  commands: Array<{ file: string; args: string[] }>;
};

/**
 * Fase 1 (pura): resolve env + valida + monta os argv. Não toca disco nem executa nada, então
 * dá para testar toda a preparação do backup sem `pg_dump`/Docker reais.
 */
export function prepareBackup(
  options: { cwd?: string; env?: EnvLike; now?: Date; container?: string; backupDir?: string } = {}
): BackupPlan {
  const resolved = resolveDatabaseUrl({ cwd: options.cwd, env: options.env });
  const identity = parseDbIdentity(resolved.value);
  if (!identity || !identity.database) {
    throw new EnvResolutionError("[db-backup] DATABASE_URL resolvida não contém um nome de banco — abortando backup.");
  }

  const container = options.container ?? defaultContainer();
  const backupDir = options.backupDir ?? defaultBackupDir();
  const file = `inseries_${identity.database}_${timestamp(options.now)}.dump`;
  const containerPath = `/tmp/${file}`;
  const hostPath = join(backupDir, file);

  return {
    identity,
    maskedUrl: maskDatabaseUrl(resolved.value),
    container,
    backupDir,
    hostPath,
    containerPath,
    commands: [
      // Sempre execFileSync + array de argumentos: nada é interpolado em shell.
      { file: "docker", args: ["exec", container, "pg_dump", "-U", "inseries", "-d", identity.database, "-F", "c", "-f", containerPath] },
      { file: "docker", args: ["cp", `${container}:${containerPath}`, hostPath] },
      { file: "docker", args: ["exec", container, "rm", "-f", containerPath] }
    ]
  };
}

export type CommandRunner = (file: string, args: string[]) => void;

const defaultRunner: CommandRunner = (file, args) => {
  execFileSync(file, args, { stdio: "inherit" });
};

/**
 * Sanitiza o erro de um subprocesso: só o nome do binário e o exit status sobrevivem.
 * argv, stdout/stderr e env do filho são descartados — qualquer um deles poderia carregar a URL.
 */
function sanitizeSubprocessError(file: string, error: unknown): string {
  const status = (error as { status?: number | null } | null)?.status;
  const signal = (error as { signal?: string | null } | null)?.signal;
  if (typeof status === "number") return `subprocesso "${file}" terminou com código ${status}`;
  if (signal) return `subprocesso "${file}" terminou por sinal ${signal}`;
  return `subprocesso "${file}" falhou`;
}

export function applyRetention(backupDir: string, retention: number = RETENTION_COUNT) {
  if (!existsSync(backupDir)) return;
  const files = readdirSync(backupDir)
    .filter((f) => f.endsWith(".dump"))
    .map((f) => ({ name: f, mtime: statSync(join(backupDir, f)).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime);

  for (const stale of files.slice(retention)) {
    unlinkSync(join(backupDir, stale.name));
    console.log(`[db-backup] removido backup antigo (retenção ${retention}): ${stale.name}`);
  }
}

/**
 * Fase 2 (efeitos): executa o plano. Falha de subprocesso, arquivo ausente ou dump vazio são
 * erro fatal — o chamador DEVE abortar a migração. Nenhuma mensagem daqui contém credencial.
 */
export function executeBackup(plan: BackupPlan, run: CommandRunner = defaultRunner): string {
  mkdirSync(plan.backupDir, { recursive: true });

  console.log(`[db-backup] banco: ${plan.maskedUrl}`);
  console.log(`[db-backup] gerando dump em ${plan.containerPath} (container ${plan.container})...`);

  for (const command of plan.commands) {
    try {
      run(command.file, command.args);
    } catch (error) {
      throw new Error(
        `[db-backup] falha ao gerar/copiar backup — migração NÃO deve prosseguir: ${sanitizeSubprocessError(command.file, error)}`
      );
    }
  }

  if (!existsSync(plan.hostPath) || statSync(plan.hostPath).size === 0) {
    throw new Error(`[db-backup] arquivo de backup ausente ou vazio em ${plan.hostPath} — migração NÃO deve prosseguir.`);
  }

  console.log(`[db-backup] ok: ${plan.hostPath} (${statSync(plan.hostPath).size} bytes)`);
  applyRetention(plan.backupDir);
  return plan.hostPath;
}

/** Runs `pg_dump -F c` inside the Postgres container and copies the dump out. Throws on any failure — callers must treat a failed backup as a hard stop, never proceed with a migration. */
export function runBackup(
  options: { cwd?: string; env?: EnvLike; run?: CommandRunner } = {}
): string {
  const plan = prepareBackup({ cwd: options.cwd, env: options.env });
  return executeBackup(plan, options.run);
}

if (require.main === module) {
  try {
    runBackup();
  } catch (error) {
    console.error((error as Error).message);
    process.exit(1);
  }
}

import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { mkdtempSync, writeFileSync, rmSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { executeBackup, prepareBackup, type BackupPlan } from "./backup";
import { EnvResolutionError, type EnvLike } from "./resolve-env";

const REAL_URL = "postgresql://inseries:segredo123@127.0.0.1:5433/inseries?schema=public";
const NOW = new Date("2026-08-03T12:00:00.000Z");

let cwd: string;
let backupDir: string;

beforeEach(() => {
  cwd = mkdtempSync(join(tmpdir(), "db-guard-backup-"));
  backupDir = join(cwd, "backups");
});

afterEach(() => {
  rmSync(cwd, { recursive: true, force: true });
});

function plan(env: EnvLike = { DATABASE_URL: REAL_URL }): BackupPlan {
  return prepareBackup({ cwd, env, now: NOW, container: "inseries-postgres", backupDir });
}

describe("prepareBackup", () => {
  it("monta o plano com config válida sem executar nada", () => {
    const result = plan();
    expect(result.identity.database).toBe("inseries");
    expect(result.hostPath).toBe(join(backupDir, "inseries_inseries_2026-08-03T12-00-00-000Z.dump"));
    expect(result.commands.map((c) => c.file)).toEqual(["docker", "docker", "docker"]);
    expect(result.commands[0].args).toEqual([
      "exec", "inseries-postgres", "pg_dump", "-U", "inseries", "-d", "inseries",
      "-F", "c", "-f", result.containerPath
    ]);
  });

  it("mascara a senha na URL exposta ao log", () => {
    expect(plan().maskedUrl).not.toContain("segredo123");
    expect(plan().maskedUrl).toContain("***");
  });

  it("todos os argumentos são passados como array, nunca uma string de shell", () => {
    for (const command of plan().commands) {
      expect(Array.isArray(command.args)).toBe(true);
      expect(command.args.join(" ")).not.toContain("segredo123");
    }
  });

  it("falha de resolução impede o backup, com erro sanitizado", () => {
    expect(() => plan({})).toThrow(EnvResolutionError);
    expect(() => plan({ DATABASE_URL: "[SENSITIVE]" })).toThrow(/placeholder redigido/);
    try {
      plan({ DATABASE_URL: "mysql://u:segredo123@h:3306/d" });
    } catch (error) {
      expect((error as Error).message).not.toContain("segredo123");
    }
  });
});

describe("executeBackup", () => {
  it("executa os comandos na ordem e aceita dump não-vazio", () => {
    const p = plan();
    const calls: string[][] = [];
    const run = vi.fn((file: string, args: string[]) => {
      calls.push([file, ...args]);
      if (args[0] === "cp") {
        mkdirSync(backupDir, { recursive: true });
        writeFileSync(p.hostPath, "conteudo-do-dump");
      }
    });

    expect(executeBackup(p, run)).toBe(p.hostPath);
    expect(run).toHaveBeenCalledTimes(3);
    expect(calls[0][3]).toBe("pg_dump");
    expect(calls[1][1]).toBe("cp");
    expect(calls[2][3]).toBe("rm");
  });

  it("rejeita dump vazio", () => {
    const p = plan();
    const run = () => {
      mkdirSync(backupDir, { recursive: true });
      writeFileSync(p.hostPath, "");
    };
    expect(() => executeBackup(p, run)).toThrow(/ausente ou vazio/);
  });

  it("rejeita quando o arquivo nem foi criado", () => {
    expect(() => executeBackup(plan(), () => {})).toThrow(/ausente ou vazio/);
  });

  it("sanitiza erro de subprocesso — nunca ecoa argv/stderr do filho", () => {
    const p = plan();
    const run = () => {
      const error = new Error(`Command failed: docker exec ... ${REAL_URL}`) as Error & { status: number; stderr: string };
      error.status = 1;
      error.stderr = `pg_dump: error: connection to ${REAL_URL} failed`;
      throw error;
    };

    let message = "";
    try {
      executeBackup(p, run);
    } catch (error) {
      message = (error as Error).message;
    }

    expect(message).toContain("migração NÃO deve prosseguir");
    expect(message).toContain("código 1");
    expect(message).not.toContain("segredo123");
    expect(message).not.toContain("postgresql://");
    expect(message).not.toContain("Command failed");
  });
});

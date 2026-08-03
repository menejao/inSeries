import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { mkdtempSync, writeFileSync, rmSync, readdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  EnvResolutionError,
  hydrateProcessEnv,
  isPlaceholder,
  isUsable,
  parseEnvFile,
  resolveDatabaseUrl,
  resolveEnvVar,
  type EnvLike
} from "./resolve-env";

const REAL_URL = "postgresql://user:pass@127.0.0.1:5433/inseries?schema=public";
const OTHER_URL = "postgresql://user:pass@127.0.0.1:5433/outro?schema=public";

let cwd: string;

beforeEach(() => {
  cwd = mkdtempSync(join(tmpdir(), "db-guard-env-"));
});

afterEach(() => {
  rmSync(cwd, { recursive: true, force: true });
});

function writeEnv(name: string, content: string) {
  writeFileSync(join(cwd, name), content, "utf8");
}

describe("parseEnvFile", () => {
  it("le pares simples, aspas e ignora comentarios/linhas vazias", () => {
    const parsed = parseEnvFile(["# comentario", "", "A=1", 'B="dois"', "C='tres'", "export D=4", "lixo"].join("\n"));
    expect(parsed).toEqual({ A: "1", B: "dois", C: "tres", D: "4" });
  });

  it("preserva '=' dentro do valor (URLs com query string)", () => {
    expect(parseEnvFile(`DATABASE_URL=${REAL_URL}`).DATABASE_URL).toBe(REAL_URL);
  });
});

describe("isPlaceholder / isUsable", () => {
  it("reconhece [SENSITIVE] como placeholder", () => {
    expect(isPlaceholder("[SENSITIVE]")).toBe(true);
    expect(isUsable("[SENSITIVE]")).toBe(false);
  });

  it("trata ausente e vazio como nao utilizaveis", () => {
    expect(isUsable(undefined)).toBe(false);
    expect(isUsable("")).toBe(false);
    expect(isUsable("   ")).toBe(false);
  });

  it("aceita valor real", () => {
    expect(isUsable(REAL_URL)).toBe(true);
    expect(isPlaceholder(REAL_URL)).toBe(false);
  });
});

describe("resolveEnvVar", () => {
  it("usa a variavel herdada do processo quando valida", () => {
    writeEnv(".env", `DATABASE_URL=${OTHER_URL}`);
    expect(resolveEnvVar("DATABASE_URL", { cwd, env: { DATABASE_URL: REAL_URL } })).toEqual({
      value: REAL_URL,
      source: "process"
    });
  });

  it("cai para .env quando a variavel do processo esta ausente", () => {
    writeEnv(".env", `DATABASE_URL=${REAL_URL}`);
    expect(resolveEnvVar("DATABASE_URL", { cwd, env: {} })).toEqual({ value: REAL_URL, source: ".env" });
  });

  it("cai para .env quando a variavel do processo esta vazia", () => {
    writeEnv(".env", `DATABASE_URL=${REAL_URL}`);
    expect(resolveEnvVar("DATABASE_URL", { cwd, env: { DATABASE_URL: "" } })?.source).toBe(".env");
  });

  it("cai para arquivo quando a variavel do processo e [SENSITIVE]", () => {
    writeEnv(".env", `DATABASE_URL=${REAL_URL}`);
    expect(resolveEnvVar("DATABASE_URL", { cwd, env: { DATABASE_URL: "[SENSITIVE]" } })).toEqual({
      value: REAL_URL,
      source: ".env"
    });
  });

  it(".env.local sobrepoe .env", () => {
    writeEnv(".env", `DATABASE_URL=${OTHER_URL}`);
    writeEnv(".env.local", `DATABASE_URL=${REAL_URL}`);
    expect(resolveEnvVar("DATABASE_URL", { cwd, env: {} })).toEqual({ value: REAL_URL, source: ".env.local" });
  });

  it("ignora placeholder dentro do arquivo e continua descendo a precedencia", () => {
    writeEnv(".env", `DATABASE_URL=${REAL_URL}`);
    writeEnv(".env.local", 'DATABASE_URL="[SENSITIVE]"');
    expect(resolveEnvVar("DATABASE_URL", { cwd, env: {} })?.source).toBe(".env");
  });

  it("NUNCA le .env.production.local (a causa raiz do bug)", () => {
    writeEnv(".env.production.local", 'DATABASE_URL="[SENSITIVE]"');
    writeEnv(".env", `DATABASE_URL=${REAL_URL}`);
    expect(resolveEnvVar("DATABASE_URL", { cwd, env: {} })).toEqual({ value: REAL_URL, source: ".env" });
  });

  it("retorna null quando nenhuma camada tem valor", () => {
    expect(resolveEnvVar("DATABASE_URL", { cwd, env: {} })).toBeNull();
  });
});

describe("resolveDatabaseUrl", () => {
  it("resolve URL valida herdada", () => {
    expect(resolveDatabaseUrl({ cwd, env: { DATABASE_URL: REAL_URL } }).value).toBe(REAL_URL);
  });

  it("aceita protocolo postgres:", () => {
    expect(resolveDatabaseUrl({ cwd, env: { DATABASE_URL: "postgres://u:p@h:5432/d" } }).source).toBe("process");
  });

  it("erro claro quando ausente", () => {
    expect(() => resolveDatabaseUrl({ cwd, env: {} })).toThrow(EnvResolutionError);
    expect(() => resolveDatabaseUrl({ cwd, env: {} })).toThrow(/ausente/);
  });

  it("erro especifico de placeholder quando vale [SENSITIVE] e nao ha arquivo", () => {
    expect(() => resolveDatabaseUrl({ cwd, env: { DATABASE_URL: "[SENSITIVE]" } })).toThrow(/placeholder redigido/);
  });

  it("erro especifico quando vazia", () => {
    expect(() => resolveDatabaseUrl({ cwd, env: { DATABASE_URL: "" } })).toThrow(/vazia/);
  });

  it("rejeita protocolo invalido", () => {
    expect(() => resolveDatabaseUrl({ cwd, env: { DATABASE_URL: "mysql://u:p@h:3306/d" } })).toThrow(/protocolo "mysql:"/);
  });

  it("rejeita string que nao e URL", () => {
    expect(() => resolveDatabaseUrl({ cwd, env: { DATABASE_URL: "not-a-url" } })).toThrow(/URL/);
  });

  it("nenhuma mensagem de erro contem senha, host ou a URL", () => {
    const cases = ["mysql://user:supersecret@host:3306/db", "not-a-url-supersecret", "[SENSITIVE]", ""];
    for (const value of cases) {
      let message = "";
      try {
        resolveDatabaseUrl({ cwd, env: { DATABASE_URL: value } });
      } catch (error) {
        message = (error as Error).message;
      }
      expect(message).not.toBe("");
      expect(message).not.toContain("supersecret");
      expect(message).not.toContain("user:");
      expect(message).not.toContain("//host");
    }
  });

  it("nunca escreve em arquivos .env", () => {
    writeEnv(".env", `DATABASE_URL=${REAL_URL}`);
    const before = readFileSync(join(cwd, ".env"), "utf8");
    resolveDatabaseUrl({ cwd, env: {} });
    expect(readdirSync(cwd)).toEqual([".env"]);
    expect(readFileSync(join(cwd, ".env"), "utf8")).toBe(before);
  });
});

describe("hydrateProcessEnv", () => {
  it("preenche apenas o que falta e reporta a origem", () => {
    writeEnv(".env", [`DATABASE_URL=${REAL_URL}`, "DB_ENVIRONMENT=development"].join("\n"));
    const env: EnvLike = { DB_ENVIRONMENT: "homologation" };
    const report = hydrateProcessEnv(["DATABASE_URL", "DB_ENVIRONMENT", "SHADOW_DATABASE_URL"], { cwd, env });

    expect(report).toEqual({ DATABASE_URL: ".env", DB_ENVIRONMENT: "process", SHADOW_DATABASE_URL: "unresolved" });
    expect(env.DB_ENVIRONMENT).toBe("homologation");
    expect(env.DATABASE_URL).toBe(REAL_URL);
  });

  it("remove placeholder herdado que nao pode ser resolvido, em vez de deixa-lo passar", () => {
    const env: EnvLike = { DATABASE_URL: "[SENSITIVE]" };
    hydrateProcessEnv(["DATABASE_URL"], { cwd, env });
    expect(env.DATABASE_URL).toBeUndefined();
  });
});

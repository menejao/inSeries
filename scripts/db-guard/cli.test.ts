import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { runCli, isGuardAction, type CliDeps } from "./cli";
import { EnvResolutionError } from "./resolve-env";

const REAL_URL = "postgresql://inseries:segredo123@127.0.0.1:5433/inseries?schema=public";

function makeDeps(overrides: Partial<CliDeps> = {}) {
  const order: string[] = [];
  const deps: CliDeps = {
    hydrate: vi.fn(() => {
      order.push("hydrate");
      return { DATABASE_URL: ".env" as const };
    }) as unknown as CliDeps["hydrate"],
    resolveDb: vi.fn(() => {
      order.push("resolveDb");
      return { value: REAL_URL, source: "process" as const, variable: "DATABASE_URL" };
    }) as unknown as CliDeps["resolveDb"],
    guard: vi.fn(() => {
      order.push("guard");
    }),
    backup: vi.fn(() => {
      order.push("backup");
      return "/tmp/x.dump";
    }) as unknown as CliDeps["backup"],
    runPrisma: vi.fn(() => {
      order.push("prisma");
    }),
    ...overrides
  };
  return { deps, order };
}

let logSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
});

afterEach(() => {
  logSpy.mockRestore();
});

describe("isGuardAction", () => {
  it("aceita só as quatro ações conhecidas", () => {
    expect(["check", "create", "deploy", "status"].every(isGuardAction)).toBe(true);
    expect(isGuardAction("reset")).toBe(false);
    expect(isGuardAction(undefined)).toBe(false);
  });
});

describe("runCli — ordem do fluxo", () => {
  it("create: resolução -> guard -> backup -> prisma", () => {
    const { deps, order } = makeDeps();
    runCli("create", [], deps);
    expect(order).toEqual(["hydrate", "resolveDb", "guard", "backup", "prisma"]);
    expect(deps.runPrisma).toHaveBeenCalledWith(["migrate", "dev", "--create-only"]);
  });

  it("deploy: também faz backup antes do prisma", () => {
    const { deps, order } = makeDeps();
    runCli("deploy", [], deps);
    expect(order).toEqual(["hydrate", "resolveDb", "guard", "backup", "prisma"]);
    expect(deps.runPrisma).toHaveBeenCalledWith(["migrate", "deploy"]);
  });

  it("status: sem backup", () => {
    const { deps, order } = makeDeps();
    runCli("status", [], deps);
    expect(order).toEqual(["hydrate", "resolveDb", "guard", "prisma"]);
  });

  it("falha de resolução aborta antes do guard, do backup e do prisma", () => {
    const { deps, order } = makeDeps({
      resolveDb: vi.fn(() => {
        throw new EnvResolutionError("[db-guard] DATABASE_URL ausente.");
      }) as unknown as CliDeps["resolveDb"]
    });
    expect(() => runCli("deploy", [], deps)).toThrow(EnvResolutionError);
    expect(order).toEqual(["hydrate"]);
    expect(deps.guard).not.toHaveBeenCalled();
    expect(deps.backup).not.toHaveBeenCalled();
    expect(deps.runPrisma).not.toHaveBeenCalled();
  });

  it("backup falhando impede o prisma", () => {
    const { deps } = makeDeps({
      backup: vi.fn(() => {
        throw new Error("[db-backup] falha ao gerar/copiar backup");
      }) as unknown as CliDeps["backup"]
    });
    expect(() => runCli("deploy", [], deps)).toThrow(/backup falhou — comando NÃO será executado/);
    expect(deps.runPrisma).not.toHaveBeenCalled();
  });

  it("guard bloqueando impede backup e prisma", () => {
    const { deps } = makeDeps({
      guard: vi.fn(() => {
        throw new Error("[db-guard] comando bloqueado");
      })
    });
    expect(() => runCli("create", [], deps)).toThrow(/bloqueado/);
    expect(deps.backup).not.toHaveBeenCalled();
    expect(deps.runPrisma).not.toHaveBeenCalled();
  });

  it("nenhum log do fluxo contém a URL/senha", () => {
    const { deps } = makeDeps();
    runCli("deploy", [], deps);
    const logged = logSpy.mock.calls.flat().join("\n");
    expect(logged).not.toContain("segredo123");
    expect(logged).not.toContain(REAL_URL);
  });
});

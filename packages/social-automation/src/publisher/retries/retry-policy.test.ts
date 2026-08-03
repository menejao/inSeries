import { describe, expect, it, vi } from "vitest";
import { computeBackoffMs, runWithRetry } from "./retry-policy";
import { PublishError } from "../instagram/errors";

describe("computeBackoffMs", () => {
  it("cresce exponencialmente a partir da base (1s, 2s, 4s, 8s)", () => {
    expect(computeBackoffMs(1, 1_000)).toBe(1_000);
    expect(computeBackoffMs(2, 1_000)).toBe(2_000);
    expect(computeBackoffMs(3, 1_000)).toBe(4_000);
    expect(computeBackoffMs(4, 1_000)).toBe(8_000);
  });

  it("respeita o teto configurado", () => {
    expect(computeBackoffMs(10, 1_000, 5_000)).toBe(5_000);
  });
});

describe("runWithRetry", () => {
  it("nao repete quando a primeira tentativa funciona", async () => {
    const task = vi.fn(async () => "ok");
    await expect(runWithRetry(task, { maxAttempts: 3 })).resolves.toEqual({ result: "ok", attempts: 1 });
    expect(task).toHaveBeenCalledTimes(1);
  });

  it("repete erros de timeout com backoff exponencial e conta as tentativas", async () => {
    const delays: number[] = [];
    let calls = 0;
    const task = vi.fn(async () => {
      calls++;
      if (calls < 3) throw new PublishError("timeout", "sem resposta");
      return "ok";
    });

    const outcome = await runWithRetry(task, {
      maxAttempts: 3,
      baseDelayMs: 1_000,
      sleep: async (ms) => {
        delays.push(ms);
      }
    });

    expect(outcome).toEqual({ result: "ok", attempts: 3 });
    expect(delays).toEqual([1_000, 2_000]);
  });

  it("repete rate-limit (429) e erro 5xx temporario", async () => {
    for (const kind of ["rate-limit", "temporary"] as const) {
      let calls = 0;
      const task = async () => {
        calls++;
        if (calls === 1) throw new PublishError(kind, "transitorio");
        return "ok";
      };
      await expect(runWithRetry(task, { maxAttempts: 2, sleep: async () => undefined })).resolves.toMatchObject({ attempts: 2 });
    }
  });

  it("NUNCA repete erro de autenticacao", async () => {
    const task = vi.fn(async () => {
      throw new PublishError("auth", "token invalido");
    });

    await expect(runWithRetry(task, { maxAttempts: 5, sleep: async () => undefined })).rejects.toMatchObject({ kind: "auth" });
    expect(task).toHaveBeenCalledTimes(1);
  });

  it("NUNCA repete erro de permissao nem de midia invalida", async () => {
    for (const kind of ["permission", "invalid-media", "validation", "not-configured"] as const) {
      const task = vi.fn(async () => {
        throw new PublishError(kind, kind);
      });
      await expect(runWithRetry(task, { maxAttempts: 5, sleep: async () => undefined })).rejects.toMatchObject({ kind });
      expect(task).toHaveBeenCalledTimes(1);
    }
  });

  it("para no limite de tentativas e propaga o ultimo erro", async () => {
    const task = vi.fn(async () => {
      throw new PublishError("timeout", "sempre lento");
    });

    await expect(runWithRetry(task, { maxAttempts: 3, sleep: async () => undefined })).rejects.toMatchObject({ kind: "timeout" });
    expect(task).toHaveBeenCalledTimes(3);
  });

  it("chama onRetry uma vez por reagendamento, com o atraso calculado", async () => {
    const onRetry = vi.fn();
    const task = vi.fn(async () => {
      throw new PublishError("timeout", "lento");
    });

    await expect(runWithRetry(task, { maxAttempts: 3, baseDelayMs: 1_000, sleep: async () => undefined, onRetry })).rejects.toThrow();

    expect(onRetry).toHaveBeenCalledTimes(2);
    expect(onRetry.mock.calls[0][0]).toMatchObject({ attempt: 1, delayMs: 1_000 });
    expect(onRetry.mock.calls[1][0]).toMatchObject({ attempt: 2, delayMs: 2_000 });
  });

  it("trata erro desconhecido (bug) como temporario para nao matar a publicacao", async () => {
    let calls = 0;
    const task = async () => {
      calls++;
      if (calls === 1) throw new Error("bug qualquer");
      return "ok";
    };

    await expect(runWithRetry(task, { maxAttempts: 2, sleep: async () => undefined })).resolves.toMatchObject({ attempts: 2 });
  });
});

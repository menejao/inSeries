import { describe, expect, it, vi } from "vitest";
import { PublishQueue } from "./publish-queue";

describe("PublishQueue", () => {
  it("deduplica duas chamadas concorrentes da MESMA publicacao (idempotencia)", async () => {
    const queue = new PublishQueue({ maxConcurrent: 4 });
    const task = vi.fn(async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
      return "externalId-1";
    });

    const [a, b] = await Promise.all([queue.run("pub-1", task), queue.run("pub-1", task)]);

    expect(task).toHaveBeenCalledTimes(1);
    expect(a).toBe("externalId-1");
    expect(b).toBe(a);
  });

  it("publicacoes diferentes nao sao deduplicadas", async () => {
    const queue = new PublishQueue({ maxConcurrent: 4 });
    const task = vi.fn(async () => "ok");

    await Promise.all([queue.run("pub-1", task), queue.run("pub-2", task)]);

    expect(task).toHaveBeenCalledTimes(2);
  });

  it("respeita a concorrencia maxima (1 por vez por padrao)", async () => {
    const queue = new PublishQueue({ maxConcurrent: 1 });
    let concurrent = 0;
    let peak = 0;

    const task = async () => {
      concurrent++;
      peak = Math.max(peak, concurrent);
      await new Promise((resolve) => setTimeout(resolve, 5));
      concurrent--;
      return "ok";
    };

    await Promise.all([queue.run("a", task), queue.run("b", task), queue.run("c", task)]);

    expect(peak).toBe(1);
  });

  it("permite concorrencia configuravel maior que 1", async () => {
    const queue = new PublishQueue({ maxConcurrent: 2 });
    let concurrent = 0;
    let peak = 0;

    const task = async () => {
      concurrent++;
      peak = Math.max(peak, concurrent);
      await new Promise((resolve) => setTimeout(resolve, 5));
      concurrent--;
      return "ok";
    };

    await Promise.all([queue.run("a", task), queue.run("b", task), queue.run("c", task), queue.run("d", task)]);

    expect(peak).toBe(2);
  });

  it("libera o id apos a falha, permitindo uma nova tentativa manual depois", async () => {
    const queue = new PublishQueue();
    await expect(
      queue.run("pub-1", async () => {
        throw new Error("falhou");
      })
    ).rejects.toThrow("falhou");

    expect(queue.isInFlight("pub-1")).toBe(false);
    await expect(queue.run("pub-1", async () => "ok")).resolves.toBe("ok");
  });

  it("propaga a rejeicao para todos os chamadores que entraram na mesma execucao", async () => {
    const queue = new PublishQueue();
    const task = async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
      throw new Error("falhou");
    };

    const first = queue.run("pub-1", task);
    const second = queue.run("pub-1", task);

    await expect(first).rejects.toThrow("falhou");
    await expect(second).rejects.toThrow("falhou");
  });

  it("libera a fila mesmo quando a task rejeita (nao trava o semaforo)", async () => {
    const queue = new PublishQueue({ maxConcurrent: 1 });

    await expect(
      queue.run("a", async () => {
        throw new Error("x");
      })
    ).rejects.toThrow();

    await expect(queue.run("b", async () => "ok")).resolves.toBe("ok");
  });
});

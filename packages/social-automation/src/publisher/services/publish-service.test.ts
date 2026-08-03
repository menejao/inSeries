import { beforeEach, describe, expect, it, vi } from "vitest";
import { PublishQueue } from "../queue/publish-queue";
import { PublishError } from "../instagram/errors";
import type { SocialPublication } from "@prisma/client";

/**
 * INSERIES-INSTAGRAM-PUBLISHER-05 — o orquestrador testado com banco, historico e registry
 * totalmente mockados. Nenhuma chamada de rede, nenhum Prisma, nenhum token.
 */

const rows = new Map<string, SocialPublication>();
const historyEvents: Array<{ action: string; detail?: Record<string, unknown> }> = [];

/**
 * `overrides` is intentionally loose (`Record<string, unknown>`) instead of `Partial<SocialPublication>`:
 * the generated Prisma enum does not know UPLOADING/CANCELLED until this ticket's migration runs,
 * and the tests must be able to build rows in those states today.
 */
function makeRow(overrides: Record<string, unknown> = {}): SocialPublication {
  const base = {
    id: "pub-1",
    contentId: "content-1",
    network: "INSTAGRAM",
    caption: "legenda",
    mediaRef: "placeholder://pub-1#feed",
    scheduledFor: new Date("2026-08-03T10:00:00.000Z"),
    status: "PENDING",
    publishedAt: null,
    externalId: null,
    attempts: 0,
    lastError: null,
    createdAt: new Date(),
    updatedAt: new Date()
  };
  return { ...base, ...overrides } as unknown as SocialPublication;
}

function patch(id: string, data: Record<string, unknown>): SocialPublication {
  const current = rows.get(id);
  if (!current) throw new Error(`row ${id} nao existe no fake`);
  const next = { ...current, ...data } as SocialPublication;
  rows.set(id, next);
  return next;
}

vi.mock("../../db/publication-repo", () => ({
  publicationRepo: {
    findById: vi.fn(async (id: string) => rows.get(id) ?? null),
    updateStatus: vi.fn(async (id: string, status: string) => patch(id, { status })),
    markUploading: vi.fn(async (id: string) => patch(id, { status: "UPLOADING" })),
    incrementAttempts: vi.fn(async (id: string) => patch(id, { attempts: ((rows.get(id) as { attempts?: number })?.attempts ?? 0) + 1 })),
    markPublishedWithAttempts: vi.fn(async (id: string, externalId: string, attempts: number) =>
      patch(id, { status: "PUBLISHED", externalId, attempts, publishedAt: new Date(), lastError: null })
    ),
    markFailedWithError: vi.fn(async (id: string, lastError: string, attempts: number) => patch(id, { status: "FAILED", lastError, attempts })),
    markCancelled: vi.fn(async (id: string, reason: string) => patch(id, { status: "CANCELLED", lastError: reason })),
    reschedule: vi.fn(async (id: string, scheduledFor: Date) => patch(id, { scheduledFor, status: "SCHEDULED" }))
  }
}));

vi.mock("../../db/content-repo", () => ({
  contentRepo: { updateStatus: vi.fn(async () => undefined) }
}));

vi.mock("../../history", () => ({
  recordHistory: vi.fn(async (event: { action: string; detail?: Record<string, unknown> }) => {
    historyEvents.push({ action: event.action, ...(event.detail ? { detail: event.detail } : {}) });
  })
}));

const { publishPublication, cancelPublication, schedulePublication, refreshPublicationStatus } = await import("./publish-service");
const { publicationRepo } = await import("../../db/publication-repo");

function fakePublisher(impl: () => Promise<{ externalId: string }>) {
  return { publish: vi.fn(impl) };
}

beforeEach(() => {
  rows.clear();
  rows.set("pub-1", makeRow());
  historyEvents.length = 0;
  vi.clearAllMocks();
});

describe("publishPublication", () => {
  it("publica uma PENDING devida e persiste PUBLISHED + externalId + attempts", async () => {
    const publisher = fakePublisher(async () => ({ externalId: "ig-1" }));

    const result = await publishPublication("pub-1", {
      publisher,
      queue: new PublishQueue(),
      now: () => new Date("2026-08-03T12:00:00.000Z")
    });

    expect(result).toMatchObject({ status: "PUBLISHED", externalId: "ig-1", attempts: 1 });
    expect(rows.get("pub-1")).toMatchObject({ status: "PUBLISHED", externalId: "ig-1" });
    expect(historyEvents.map((event) => event.action)).toEqual(["PUBLISH_ATTEMPTED", "PUBLISH_SUCCEEDED"]);
  });

  it("passa por UPLOADING antes de PUBLISHING (estados novos do ciclo real)", async () => {
    const publisher = fakePublisher(async () => ({ externalId: "ig-1" }));
    await publishPublication("pub-1", { publisher, queue: new PublishQueue(), now: () => new Date("2026-08-03T12:00:00.000Z") });

    expect(publicationRepo.markUploading).toHaveBeenCalledWith("pub-1");
    expect(publicationRepo.updateStatus).toHaveBeenCalledWith("pub-1", "PUBLISHING");
  });

  it("nao publica uma publicacao agendada para o futuro sem force", async () => {
    rows.set("pub-1", makeRow({ status: "SCHEDULED", scheduledFor: new Date("2026-08-04T10:00:00.000Z") }));
    const publisher = fakePublisher(async () => ({ externalId: "nunca" }));

    const result = await publishPublication("pub-1", { publisher, queue: new PublishQueue(), now: () => new Date("2026-08-03T12:00:00.000Z") });

    expect(result.skippedReason).toBe("future");
    expect(publisher.publish).not.toHaveBeenCalled();
  });

  it("force publica imediatamente uma publicacao futura", async () => {
    rows.set("pub-1", makeRow({ status: "SCHEDULED", scheduledFor: new Date("2026-08-04T10:00:00.000Z") }));
    const publisher = fakePublisher(async () => ({ externalId: "ig-forcado" }));

    const result = await publishPublication("pub-1", {
      publisher,
      force: true,
      queue: new PublishQueue(),
      now: () => new Date("2026-08-03T12:00:00.000Z")
    });

    expect(result).toMatchObject({ status: "PUBLISHED", externalId: "ig-forcado" });
  });

  it("nunca republica uma publicacao ja PUBLISHED (idempotencia no banco)", async () => {
    rows.set("pub-1", makeRow({ status: "PUBLISHED", externalId: "ja-publicado" }));
    const publisher = fakePublisher(async () => ({ externalId: "duplicado" }));

    const result = await publishPublication("pub-1", { publisher, force: true, queue: new PublishQueue() });

    expect(result.skippedReason).toBe("terminal");
    expect(publisher.publish).not.toHaveBeenCalled();
  });

  it("nunca publica uma publicacao CANCELLED", async () => {
    rows.set("pub-1", makeRow({ status: "CANCELLED" }));
    const publisher = fakePublisher(async () => ({ externalId: "x" }));

    const result = await publishPublication("pub-1", { publisher, force: true, queue: new PublishQueue() });

    expect(result.skippedReason).toBe("cancelled");
    expect(publisher.publish).not.toHaveBeenCalled();
  });

  it("duas chamadas concorrentes da MESMA publicacao publicam uma unica vez", async () => {
    const publisher = fakePublisher(async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
      return { externalId: "ig-unico" };
    });
    const queue = new PublishQueue();
    const options = { publisher, queue, now: () => new Date("2026-08-03T12:00:00.000Z") };

    const [a, b] = await Promise.all([publishPublication("pub-1", options), publishPublication("pub-1", options)]);

    expect(publisher.publish).toHaveBeenCalledTimes(1);
    expect(a.externalId).toBe("ig-unico");
    expect(b.externalId).toBe("ig-unico");
  });

  it("erro de autenticacao marca FAILED sem nenhuma retentativa", async () => {
    const publisher = fakePublisher(async () => {
      throw new PublishError("auth", "token invalido");
    });

    await expect(
      publishPublication("pub-1", { publisher, queue: new PublishQueue(), sleep: async () => undefined, now: () => new Date("2026-08-03T12:00:00.000Z") })
    ).rejects.toMatchObject({ kind: "auth" });

    expect(publisher.publish).toHaveBeenCalledTimes(1);
    expect(rows.get("pub-1")).toMatchObject({ status: "FAILED", attempts: 1 });
    expect(historyEvents.map((event) => event.action)).toEqual(["PUBLISH_ATTEMPTED", "PUBLISH_FAILED"]);
  });

  it("timeout e retentado com backoff e o sucesso registra o numero de tentativas", async () => {
    let calls = 0;
    const publisher = fakePublisher(async () => {
      calls++;
      if (calls < 3) throw new PublishError("timeout", "sem resposta");
      return { externalId: "ig-apos-retry" };
    });

    const result = await publishPublication("pub-1", {
      publisher,
      queue: new PublishQueue(),
      maxAttempts: 3,
      baseDelayMs: 1,
      sleep: async () => undefined,
      now: () => new Date("2026-08-03T12:00:00.000Z")
    });

    expect(result).toMatchObject({ status: "PUBLISHED", attempts: 3 });
    expect(historyEvents.filter((event) => event.action === "RETRY_SCHEDULED")).toHaveLength(2);
    expect(rows.get("pub-1")).toMatchObject({ status: "PUBLISHED", attempts: 3 });
  });

  it("grava lastError mascarado, sem token, quando esgota as tentativas", async () => {
    const publisher = fakePublisher(async () => {
      throw new PublishError("temporary", "falha com Bearer EAAsupersecretvalue no meio");
    });

    await expect(
      publishPublication("pub-1", {
        publisher,
        queue: new PublishQueue(),
        maxAttempts: 2,
        baseDelayMs: 1,
        sleep: async () => undefined,
        now: () => new Date("2026-08-03T12:00:00.000Z")
      })
    ).rejects.toThrow();

    const stored = rows.get("pub-1") as unknown as { lastError: string; attempts: number };
    expect(stored.lastError).not.toContain("EAAsupersecret");
    expect(stored.lastError).toContain("[redacted]");
    expect(stored.attempts).toBe(2);
  });
});

describe("cancelPublication", () => {
  it("move PENDING -> CANCELLED sem apagar a linha e registra o motivo", async () => {
    const updated = await cancelPublication("pub-1", "conteudo desatualizado");

    expect(updated.status).toBe("CANCELLED");
    expect(rows.has("pub-1")).toBe(true);
    expect(historyEvents[0]).toMatchObject({ action: "PUBLISH_FAILED", detail: { transition: "PENDING->CANCELLED", cancelled: true } });
  });

  it("exige motivo", async () => {
    await expect(cancelPublication("pub-1", "   ")).rejects.toThrow(/motivo e obrigatorio/i);
  });

  it("recusa cancelar uma publicacao ja publicada ou em voo", async () => {
    rows.set("pub-1", makeRow({ status: "PUBLISHED" }));
    await expect(cancelPublication("pub-1", "motivo")).rejects.toMatchObject({ kind: "validation" });

    rows.set("pub-1", makeRow({ status: "PUBLISHING" }));
    await expect(cancelPublication("pub-1", "motivo")).rejects.toMatchObject({ kind: "validation" });
  });

  it("permite cancelar uma FAILED (nao ficara pendente para sempre)", async () => {
    rows.set("pub-1", makeRow({ status: "FAILED" }));
    await expect(cancelPublication("pub-1", "desistimos")).resolves.toMatchObject({ status: "CANCELLED" });
  });
});

describe("schedulePublication", () => {
  it("move para o novo instante UTC e volta para SCHEDULED", async () => {
    const updated = await schedulePublication("pub-1", "2026-09-01T15:30:00.000Z");

    expect(updated.status).toBe("SCHEDULED");
    expect(updated.scheduledFor.toISOString()).toBe("2026-09-01T15:30:00.000Z");
    expect(historyEvents[0]).toMatchObject({ action: "RETRY_SCHEDULED" });
  });

  it("recusa reagendar uma publicacao ja publicada ou cancelada", async () => {
    rows.set("pub-1", makeRow({ status: "PUBLISHED" }));
    await expect(schedulePublication("pub-1", "2026-09-01T15:30:00.000Z")).rejects.toMatchObject({ kind: "validation" });

    rows.set("pub-1", makeRow({ status: "CANCELLED" }));
    await expect(schedulePublication("pub-1", "2026-09-01T15:30:00.000Z")).rejects.toMatchObject({ kind: "validation" });
  });

  it("recusa data invalida", async () => {
    await expect(schedulePublication("pub-1", "amanha talvez")).rejects.toThrow(/Data invalida/);
  });
});

describe("refreshPublicationStatus", () => {
  it("explica que nao ha integracao real quando o publisher registrado nao e o da Graph API", async () => {
    rows.set("pub-1", makeRow({ status: "PUBLISHED", externalId: "ig-1" }));

    const result = await refreshPublicationStatus("pub-1", { publisher: fakePublisher(async () => ({ externalId: "x" })) });

    expect(result.container).toBeNull();
    expect(result.note).toMatch(/Nenhum publisher real/);
  });
});

import { describe, expect, it } from "vitest";
import { canCancel, decide, isDue, isFuture, parseInstant, selectDue } from "./publish-scheduler";
import type { PublicationStatus } from "../types";

const NOW = new Date("2026-08-03T12:00:00.000Z");

function row(status: PublicationStatus, scheduledFor: string) {
  return { id: `${status}-${scheduledFor}`, status, scheduledFor: new Date(scheduledFor) };
}

describe("publish-scheduler", () => {
  it("considera devida uma publicacao no passado ou no instante atual", () => {
    expect(isDue(new Date("2026-08-03T11:59:00.000Z"), NOW)).toBe(true);
    expect(isDue(NOW, NOW)).toBe(true);
  });

  it("considera futura uma publicacao alem da tolerancia", () => {
    expect(isFuture(new Date("2026-08-03T12:05:00.000Z"), NOW)).toBe(true);
  });

  it("compara instantes absolutos (UTC), independentemente do formato de entrada", () => {
    // Mesmo instante escrito em dois offsets diferentes.
    const utc = parseInstant("2026-08-03T12:00:00.000Z");
    const offset = parseInstant("2026-08-03T09:00:00.000-03:00");
    expect(utc.getTime()).toBe(offset.getTime());
    expect(isDue(offset, NOW)).toBe(true);
  });

  it("rejeita data invalida em vez de agendar silenciosamente para NaN", () => {
    expect(() => parseInstant("nao e uma data")).toThrow(/Data invalida/);
  });

  it("publica agora uma PENDING devida", () => {
    expect(decide(row("PENDING", "2026-08-03T11:00:00.000Z"), NOW)).toEqual({ action: "publish-now", reason: "due" });
  });

  it("adia uma SCHEDULED futura", () => {
    const decision = decide(row("SCHEDULED", "2026-08-03T18:00:00.000Z"), NOW);
    expect(decision).toMatchObject({ action: "defer", reason: "future" });
  });

  it("force publica uma SCHEDULED futura (botao 'Publicar agora')", () => {
    expect(decide(row("SCHEDULED", "2026-08-04T18:00:00.000Z"), NOW, { force: true })).toEqual({
      action: "publish-now",
      reason: "immediate"
    });
  });

  it("force NUNCA republica uma PUBLISHED nem ressuscita uma CANCELLED", () => {
    expect(decide(row("PUBLISHED", "2026-08-01T10:00:00.000Z"), NOW, { force: true })).toEqual({ action: "skip", reason: "terminal" });
    expect(decide(row("CANCELLED", "2026-08-01T10:00:00.000Z"), NOW, { force: true })).toEqual({ action: "skip", reason: "cancelled" });
  });

  it("force NUNCA interrompe uma publicacao em voo", () => {
    expect(decide(row("UPLOADING", "2026-08-01T10:00:00.000Z"), NOW, { force: true })).toEqual({ action: "skip", reason: "in-flight" });
    expect(decide(row("PUBLISHING", "2026-08-01T10:00:00.000Z"), NOW, { force: true })).toEqual({ action: "skip", reason: "in-flight" });
  });

  it("selectDue devolve apenas as devidas, da mais antiga para a mais nova", () => {
    const due = selectDue(
      [
        row("SCHEDULED", "2026-08-03T18:00:00.000Z"),
        row("PENDING", "2026-08-03T10:00:00.000Z"),
        row("PUBLISHED", "2026-08-02T10:00:00.000Z"),
        row("SCHEDULED", "2026-08-03T09:00:00.000Z"),
        row("CANCELLED", "2026-08-01T10:00:00.000Z")
      ],
      NOW
    );

    expect(due.map((item) => item.scheduledFor.toISOString())).toEqual(["2026-08-03T09:00:00.000Z", "2026-08-03T10:00:00.000Z"]);
  });

  it("cancelamento e legal apenas para PENDING/SCHEDULED/FAILED", () => {
    expect(canCancel("PENDING")).toBe(true);
    expect(canCancel("SCHEDULED")).toBe(true);
    expect(canCancel("FAILED")).toBe(true);
    expect(canCancel("PUBLISHING")).toBe(false);
    expect(canCancel("UPLOADING")).toBe(false);
    expect(canCancel("PUBLISHED")).toBe(false);
    expect(canCancel("CANCELLED")).toBe(false);
  });
});

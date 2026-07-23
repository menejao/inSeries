import { describe, expect, it } from "vitest";
import { classifyTrackedSeries, type ClassifiableEpisode } from "@/lib/tracked-series/classify";

const now = new Date("2026-07-21T12:00:00Z");

function aired(daysAgo: number, watched: boolean): ClassifiableEpisode {
  return { airedAt: new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000), watched };
}

function upcoming(daysFromNow: number): ClassifiableEpisode {
  return { airedAt: new Date(now.getTime() + daysFromNow * 24 * 60 * 60 * 1000), watched: false };
}

describe("classifyTrackedSeries", () => {
  it("returns 'disponivel' (singular) when exactly 1 episode is aired and unwatched", () => {
    const result = classifyTrackedSeries([aired(1, false)], "RETURNING", now);
    expect(result.state).toBe("disponivel");
    expect(result.stateLabel).toBe("1 episodio disponivel");
    expect(result.contextLabel).toBeNull();
  });

  it("returns 'disponivel' (plural) when multiple episodes are aired and unwatched", () => {
    const result = classifyTrackedSeries([aired(3, false), aired(2, false), aired(1, false)], "RETURNING", now);
    expect(result.state).toBe("disponivel");
    expect(result.stateLabel).toBe("3 episodios disponiveis");
  });

  it("ignores watched episodes when counting available ones", () => {
    const result = classifyTrackedSeries([aired(2, true), aired(1, false)], "RETURNING", now);
    expect(result.stateLabel).toBe("1 episodio disponivel");
  });

  it("prioritizes available episodes over an upcoming one", () => {
    const result = classifyTrackedSeries([aired(1, false), upcoming(5)], "RETURNING", now);
    expect(result.state).toBe("disponivel");
  });

  it("returns 'proximo-episodio' with 'Estreia hoje' when the next episode airs later today", () => {
    const laterToday = new Date(now.getTime() + 4 * 60 * 60 * 1000); // same calendar day, 4h ahead
    const result = classifyTrackedSeries([{ airedAt: laterToday, watched: false }], "RETURNING", now);
    expect(result.state).toBe("proximo-episodio");
    expect(result.stateLabel).toBe("Estreia hoje");
  });

  it("returns 'proximo-episodio' with 'amanha' wording when the next episode airs in 1 day", () => {
    const result = classifyTrackedSeries([upcoming(1)], "RETURNING", now);
    expect(result.state).toBe("proximo-episodio");
    expect(result.stateLabel).toBe("Proximo episodio amanha");
    expect(result.contextLabel).not.toBeNull();
  });

  it("returns 'proximo-episodio' with a day count when further out", () => {
    const result = classifyTrackedSeries([upcoming(5)], "RETURNING", now);
    expect(result.state).toBe("proximo-episodio");
    expect(result.stateLabel).toBe("Proximo episodio em 5 dias");
  });

  it("returns 'aguardando-temporada' when caught up and the series is still ongoing", () => {
    const result = classifyTrackedSeries([aired(10, true)], "RETURNING", now);
    expect(result.state).toBe("aguardando-temporada");
    expect(result.stateLabel).toBe("Aguardando nova temporada");
  });

  it("treats IN_PRODUCTION and PILOT as ongoing too", () => {
    expect(classifyTrackedSeries([aired(10, true)], "IN_PRODUCTION", now).state).toBe("aguardando-temporada");
    expect(classifyTrackedSeries([aired(10, true)], "PILOT", now).state).toBe("aguardando-temporada");
  });

  it("returns 'concluida' when caught up and the series has ended", () => {
    const result = classifyTrackedSeries([aired(10, true)], "ENDED", now);
    expect(result.state).toBe("concluida");
    expect(result.stateLabel).toBe("Temporada concluida");
  });

  it("returns 'concluida' for a canceled series with nothing left to watch", () => {
    expect(classifyTrackedSeries([aired(10, true)], "CANCELED", now).state).toBe("concluida");
  });

  it("returns 'aguardando-temporada' for a returning series with zero episodes synced", () => {
    expect(classifyTrackedSeries([], "RETURNING", now).state).toBe("aguardando-temporada");
  });
});

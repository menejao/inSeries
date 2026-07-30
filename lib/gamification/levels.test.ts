import { describe, expect, it } from "vitest";
import { getLevelProgress, getLevelTitle } from "@/lib/gamification/levels";

describe("getLevelTitle", () => {
  it("maps each ticket band to its title", () => {
    expect(getLevelTitle(1)).toBe("Iniciante");
    expect(getLevelTitle(2)).toBe("Iniciante");
    expect(getLevelTitle(3)).toBe("Maratonista");
    expect(getLevelTitle(5)).toBe("Maratonista");
    expect(getLevelTitle(6)).toBe("Especialista");
    expect(getLevelTitle(8)).toBe("Especialista");
    expect(getLevelTitle(9)).toBe("Veterano");
    expect(getLevelTitle(12)).toBe("Veterano");
    expect(getLevelTitle(13)).toBe("Lenda");
    expect(getLevelTitle(16)).toBe("Lenda");
    expect(getLevelTitle(17)).toBe("Mestre das Series");
    expect(getLevelTitle(20)).toBe("Mestre das Series");
  });
});

describe("getLevelProgress", () => {
  it("starts at level 1 with 0 points", () => {
    const progress = getLevelProgress(0);
    expect(progress.level).toBe(1);
    expect(progress.title).toBe("Iniciante");
    expect(progress.isMaxLevel).toBe(false);
  });

  it("levels up as the triangular threshold is crossed", () => {
    expect(getLevelProgress(49).level).toBe(1);
    expect(getLevelProgress(50).level).toBe(2);
    expect(getLevelProgress(149).level).toBe(2);
    expect(getLevelProgress(150).level).toBe(3);
  });

  it("caps at level 20 (Mestre das Series) even with huge point totals", () => {
    const progress = getLevelProgress(999999);
    expect(progress.level).toBe(20);
    expect(progress.title).toBe("Mestre das Series");
    expect(progress.isMaxLevel).toBe(true);
    expect(progress.progressPercent).toBe(100);
    expect(progress.pointsToNextLevel).toBe(0);
  });
});

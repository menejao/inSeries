import { describe, expect, it } from "vitest";
import { resolveStateAfterEpisodeChange } from "@/lib/progress/status-resolver";

describe("resolveStateAfterEpisodeChange", () => {
  it("goes to COMPLETED whenever all available episodes are watched, regardless of prior state", () => {
    for (const state of ["WANT_TO_WATCH", "WATCHING", "PAUSED", "DROPPED", "COMPLETED", null] as const) {
      expect(resolveStateAfterEpisodeChange(state, { completed: true }, false)).toBe("COMPLETED");
    }
  });

  it("watching a new episode restores WATCHING from PAUSED or DROPPED (ticket: 'restaura Assistindo')", () => {
    expect(resolveStateAfterEpisodeChange("PAUSED", { completed: false }, true)).toBe("WATCHING");
    expect(resolveStateAfterEpisodeChange("DROPPED", { completed: false }, true)).toBe("WATCHING");
    expect(resolveStateAfterEpisodeChange("WANT_TO_WATCH", { completed: false }, true)).toBe("WATCHING");
  });

  it("unwatching an episode never forces a transition away from PAUSED/DROPPED/WATCHING", () => {
    expect(resolveStateAfterEpisodeChange("PAUSED", { completed: false }, false)).toBe("PAUSED");
    expect(resolveStateAfterEpisodeChange("DROPPED", { completed: false }, false)).toBe("DROPPED");
    expect(resolveStateAfterEpisodeChange("WATCHING", { completed: false }, false)).toBe("WATCHING");
  });

  it("leaving COMPLETED (e.g. a new episode aired, or an unmark broke 100%) falls back to WATCHING", () => {
    expect(resolveStateAfterEpisodeChange("COMPLETED", { completed: false }, false)).toBe("WATCHING");
  });
});

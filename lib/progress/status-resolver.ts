import type { WatchState } from "@/lib/types";

/**
 * INSERIES-SERIES-STATUS-ENGINE-01 — "regras de prioridade": priority ladder applied after ANY
 * episode-level change (single toggle or bulk season mark):
 *   1. all available episodes watched -> COMPLETED
 *   2. an episode was just marked watched and pending remain -> WATCHING (this is exactly what
 *      "assistir novamente numa serie Pausada/Abandonada restaura Assistindo" means)
 *   3. otherwise the state is left exactly as it was — unwatching an episode on a WATCHING/
 *      PAUSED/DROPPED series never forces a transition; only entering/leaving COMPLETED is
 *      forced (e.g. a newly-aired episode, or an unmark that breaks a 100% completion).
 * Pure function, no I/O — kept in its own module so it's testable without touching Prisma.
 */
export function resolveStateAfterEpisodeChange(
  currentState: WatchState | null,
  progress: { completed: boolean },
  justWatched: boolean
): WatchState {
  if (progress.completed) return "COMPLETED";
  if (justWatched) return "WATCHING";
  if (currentState === "COMPLETED") return "WATCHING";
  return currentState ?? "WATCHING";
}

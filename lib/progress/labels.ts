import type { WatchState } from "@/lib/types";

export const WATCH_STATE_LABELS: Record<WatchState, string> = {
  WANT_TO_WATCH: "Quero assistir",
  WATCHING: "Assistindo",
  PAUSED: "Pausada",
  DROPPED: "Abandonada",
  COMPLETED: "Concluida"
};

export const WATCH_STATE_ORDER: WatchState[] = ["WANT_TO_WATCH", "WATCHING", "PAUSED", "DROPPED", "COMPLETED"];

export function getWatchStateLabel(state: WatchState): string {
  return WATCH_STATE_LABELS[state];
}

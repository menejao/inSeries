import type { WatchState } from "@/lib/types";

export type MyListGroupKey = "WATCHING" | "WANT_TO_WATCH" | "COMPLETED" | "PAUSED" | "DROPPED" | "FAVORITES";

/** Fase 2 (INSERIES-MY-LISTS-PREMIUM-01) — a unica fonte dos rotulos de grupo (plural, "Pausadas"/"Abandonadas"), reaproveitada pelo summary do Dashboard e pela pagina completa. Distinto de `getWatchStateLabel` (lib/progress/labels.ts), que e o rotulo singular usado no badge/dropdown de status de cada card. */
export const MY_LIST_GROUP_LABELS: Record<MyListGroupKey, string> = {
  WATCHING: "Assistindo",
  WANT_TO_WATCH: "Quero assistir",
  PAUSED: "Pausadas",
  COMPLETED: "Concluidas",
  DROPPED: "Abandonadas",
  FAVORITES: "Favoritas"
};

export type MyListPreviewSeries = {
  id: string;
  slug: string;
  title: string;
  posterUrl: string | null;
  backdropUrl: string | null;
};

export type MyListGroup = {
  key: MyListGroupKey;
  label: string;
  count: number;
  preview: MyListPreviewSeries[];
};

export type MyListSummary = {
  groups: MyListGroup[];
  hasAnySeries: boolean;
};

/**
 * Fase 4 (INSERIES-MY-LISTS-PREMIUM-01) — everything a card on the full "Minha Lista" page
 * needs, straight off the already-denormalized `Series` columns (no `seasons`/`episodes`
 * join — unlike `lib/catalog/repository.ts`'s `toSeriesView`, which exists to hydrate the
 * series detail page and would be pure overhead here).
 */
export type MyListSeriesCard = {
  id: string;
  slug: string;
  title: string;
  year: number;
  posterUrl: string | null;
  backdropUrl: string | null;
  logoUrl: string | null;
  voteAverage: number | null;
  qualityScore: number | null;
  discoveryScore: number | null;
  genres: string[];
  watchProviders: string[];
  collectionTags: string[];
  keywords: string[];
  language: string | null;
  originCountry: string[];
  numberOfSeasons: number | null;
  numberOfEpisodes: number | null;
  popularityScore: number | null;
};

/**
 * One row of the full (non-preview) "Minha Lista": a tracked series plus the user's own
 * status/favorite signal for it. `state` is `null` for a series the user favorited (review
 * rating >= 4) but never explicitly gave a `UserSeriesStatus` — same edge case the original
 * Dashboard summary (`getMyListSummaryForUser`) already handles by querying `Review`
 * independently of `UserSeriesStatus`; a favorite-only series has no group among the 5
 * `WatchState` values, only among "Favoritas".
 */
export type MyListItem = {
  series: MyListSeriesCard;
  state: WatchState | null;
  completionPercent: number;
  lastActivityAt: Date | null;
  startedAt: Date | null;
  completedAt: Date | null;
  addedAt: Date;
  updatedAt: Date;
  isFavorite: boolean;
  reviewRating: number | null;
};

export type MyListFullData = {
  items: MyListItem[];
};

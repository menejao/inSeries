export type WatchState = "WANT_TO_WATCH" | "WATCHING" | "PAUSED" | "DROPPED" | "COMPLETED";

export type Episode = {
  id: string;
  number: number;
  title: string;
  overview: string;
  runtimeMinutes: number;
  airedOn: string;
  watched: boolean;
  stillUrl?: string;
};

export type Season = {
  id: string;
  number: number;
  title: string;
  year: number;
  episodeCount: number;
  posterUrl: string;
  overview?: string;
  episodes: Episode[];
};

export type Series = {
  id: string;
  slug: string;
  title: string;
  originalTitle: string;
  year: number;
  status: string;
  overview: string;
  genres: string[];
  language: string;
  platform: string;
  popularity: string;
  posterUrl: string;
  backdropUrl: string;
  seasons: Season[];
  userState?: WatchState;
  voteAverage?: number | null;
  // INSERIES-CATALOG-INTELLIGENCE-EXPERIENCE-01 — metadata already synced/derived by the
  // catalog pipeline (see lib/catalog/quality-score.ts, collection-tags.ts, normalize.ts),
  // now exposed to the UI for the first time. All additive; no sync/pipeline logic changed.
  qualityScore?: number | null;
  collectionTags: string[];
  watchProviders: string[];
  keywords: string[];
  type?: string | null;
  logoUrl?: string | null;
  originCountry: string[];
  spokenLanguages: string[];
  createdBy: string[];
  networks: string[];
  productionCompanies: string[];
  productionCountries: string[];
  tagline?: string | null;
  homepage?: string | null;
};

export type UserProfile = {
  name: string;
  username: string;
  bio: string;
  avatarUrl: string;
  followers: number;
  following: number;
  publicSeriesCount: number;
  listsCount: number;
  reviewsCount: number;
};

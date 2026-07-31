import type { SeriesLifecycleStatus } from "@prisma/client";

/** Minimal Series projection the content-engine works with — only real DB columns, nothing synthesized. */
export interface SeriesSummary {
  id: string;
  slug: string;
  title: string;
  overview: string | null;
  posterUrl: string | null;
  backdropUrl: string | null;
  firstAirYear: number | null;
  genres: string[];
  keywords: string[];
  collectionTags: string[];
  status: SeriesLifecycleStatus;
  popularityScore: number | null;
  voteAverage: number | null;
  voteCount: number | null;
  discoveryScore: number | null;
  qualityScore: number | null;
  watchProviders: string[];
  originCountry: string[];
  spokenLanguages: string[];
  numberOfSeasons: number | null;
  numberOfEpisodes: number | null;
}

/** One candidate topic a format selector proposes, already scored 0-100. */
export interface FormatCandidate {
  score: number;
  sourceSeriesId: string | null;
  /** Series involved in the candidate (primary + any related items, e.g. similar-series recs). */
  series: SeriesSummary[];
  /** Free-form structured data specific to the format (e.g. poll options, ranking criterion). */
  extra?: Record<string, unknown>;
}

export interface FormatSelectionContext {
  date: Date;
  /** Recent SocialContent rows used for repetition checks by formats that need topic-level history (e.g. inseries-feature, poll). */
  recentContent: Array<{ format: string | null; sourceSeriesId: string | null; payload: unknown; createdAt: Date }>;
}

/** Common interface every content format in formats/ implements. */
export interface ContentFormatSelector {
  key: string;
  selectCandidates(ctx: FormatSelectionContext): Promise<FormatCandidate[]>;
}

/** The structured payload persisted on SocialContent.payload, per the ticket's required shape. */
export interface ContentPayload {
  type: string;
  title: string;
  hook: string;
  sourceSeries: SeriesSummary | null;
  items: SeriesSummary[];
  caption: string;
  cta: { id: string; text: string };
  hashtags: string[];
  templateKey: string;
  requiresApproval: boolean;
  format: string;
  hookId: string;
  extra?: Record<string, unknown>;
}
